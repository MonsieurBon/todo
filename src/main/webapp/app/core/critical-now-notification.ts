import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { PushDevice } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { RemovalNote, RemovalNotes } from './removal-note';
import { WriteResult, Writes } from './writes';

/** The tag the worker shows Critical Now under, in `public/push-worker.js`. */
const TAG = 'critical-now';

const BLOCKED = 'Notifications are blocked for this app. Allow them in the browser’s settings.';
const NOT_READY = 'The app is still setting itself up on this device. Try again in a moment.';
const UNAVAILABLE =
  'The notification could not be turned on. Try again when you have a connection.';

/** How a failure to subscribe is reported: to the user who clicked, or to nobody. */
type Report = Pick<Writes, 'refuse' | 'attempt'>;

/** For a start: nobody asked, so a failure only leaves the switch off. */
const QUIETLY: Report = {
  refuse: () => 'refused',
  attempt: (change) =>
    change().then(
      () => 'done',
      () => 'refused',
    ),
};

/** Long enough for a push service that answers, short enough not to hold a sign-out up. */
const UNSUBSCRIBE_TIMEOUT_MS = 3000;

/**
 * The worker's registration, read straight from the browser. Not through `SwPush`: that answers
 * only once a worker controls the page, which after a hard reload it never does, and a sign-out
 * waiting on it would never end.
 */
export const PUSH_REGISTRATION = new InjectionToken<
  () => Promise<ServiceWorkerRegistration | null>
>('push registration', {
  factory: () => async () => (await navigator.serviceWorker?.getRegistration()) ?? null,
});

const asDevice = (subscription: PushSubscription): PushDevice => {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint: endpoint!, p256dh: keys!['p256dh'], auth: keys!['auth'] };
};

const decoded = (base64url: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const sameKey = (subscription: PushSubscription, key: string): boolean => {
  const held = subscription.options?.applicationServerKey;
  if (!held) {
    return true;
  }
  const a = new Uint8Array(held);
  const b = decoded(key);
  return a.length === b.length && a.every((octet, i) => octet === b[i]);
};

const within = <T>(ms: number, work: Promise<T>): Promise<T> =>
  Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);

/**
 * Critical Now as a notification on this device. Whether it is on is whether the browser holds a
 * push subscription for this app that has not been given up: there is no flag of our own to
 * disagree with it.
 *
 * Giving one up never waits for the network. It is noted first, ended at the push service if that
 * answers, and finished by whoever is online first — the next start, or the worker when the next
 * push arrives — since a device that signed out offline must still stop showing the titles.
 */
@Injectable({ providedIn: 'root' })
export class CriticalNowNotification {
  private readonly enabled = inject(SwPush).isEnabled && typeof PushManager !== 'undefined';
  private readonly registration = inject(PUSH_REGISTRATION);
  private readonly api = inject(TodoApi);
  private readonly writes = inject(Writes);
  private readonly notes = inject(RemovalNotes);

  private readonly key = signal<string | null>(null);
  private readonly givenUp = signal<string | null>(null);
  private readonly subscription = signal<PushSubscription | null>(null);

  readonly on = computed(() => {
    const subscription = this.subscription();
    return subscription !== null && subscription.endpoint !== this.givenUp();
  });

  /** Also while offline on a device that has it on: switching it off must stay possible. */
  readonly available = computed(() => this.enabled && (this.key() !== null || this.on()));

  /**
   * Signed out, this ends whatever subscription is still live, noted or not, since not every way a
   * session ends can stop to note it. Signed in, it registers the device again, which is what brings
   * back a notification that was swiped away: the server answers a registration with the current
   * Critical Now.
   */
  async start(signedIn: boolean): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await this.finishRemoval();
    this.subscription.set(await this.current());
    if (!signedIn) {
      if (this.on()) {
        await this.turnOff();
      }
      return;
    }
    let answered = false;
    try {
      this.key.set((await firstValueFrom(this.api.pushKey())).publicKey ?? null);
      answered = true;
    } catch {
      // Offline. The key only matters for turning it on, which needs a connection anyway.
    }
    const current = this.subscription();
    if (!current || current.endpoint === this.givenUp()) {
      return;
    }
    const key = this.key();
    if (answered && !key) {
      // The server sends nothing any more: what is shown would never change again.
      await this.turnOff();
      return;
    }
    if (key && !sameKey(current, key)) {
      // Made with a key the server no longer signs with: no push it sends could reach it.
      await this.turnOff();
      await this.subscribeWith(key, QUIETLY);
      return;
    }
    await firstValueFrom(this.api.subscribeDevice(asDevice(current))).catch(() => undefined);
  }

  async turnOn(): Promise<WriteResult> {
    const key = this.key();
    return key ? this.subscribeWith(key) : 'refused';
  }

  async turnOff(): Promise<void> {
    await this.forget();
    await this.finishRemoval();
  }

  /**
   * For sign-out, a refused session, and switching it off: everything that can be done without the
   * network, at once. Nothing here throws, nothing waits on the server, and nothing waits on
   * anything without a bound.
   */
  async forget(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const registration = await this.registration().catch(() => null);
    const subscription = await this.current(registration);
    if (!subscription) {
      // The browser may have dropped it already, with the notification permission say.
      this.subscription.set(null);
    } else {
      const { endpoint, auth } = asDevice(subscription);
      // First: whatever comes after it may fail, and the note is what finishes it later.
      await this.notes.write({ endpoint, auth }).catch(() => undefined);
      this.givenUp.set(endpoint);
      await within(UNSUBSCRIBE_TIMEOUT_MS, subscription.unsubscribe()).catch(() => false);
    }
    // After the unsubscribe, so no push can arrive to put back what was just closed.
    const shown = await registration?.getNotifications({ tag: TAG }).catch(() => []);
    shown?.forEach((notification) => notification.close());
  }

  private async subscribeWith(key: string, report: Report = this.writes): Promise<WriteResult> {
    const registration = await this.registration().catch(() => null);
    if (!registration) {
      return report.refuse(NOT_READY);
    }
    let subscription: PushSubscription;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decoded(key),
      });
    } catch (error) {
      const blocked = (error as DOMException | null)?.name === 'NotAllowedError';
      return report.refuse(blocked ? BLOCKED : UNAVAILABLE);
    }
    const device = asDevice(subscription);
    // The browser may hand back the very subscription a removal is still pending for. Taken back
    // before the server is told, since the push it answers with would find the note and end it.
    const pending: RemovalNote | null =
      subscription.endpoint === this.givenUp()
        ? { endpoint: device.endpoint, auth: device.auth }
        : null;
    if (pending) {
      await this.notes.clear(pending).catch(() => undefined);
    }
    const result = await report.attempt(
      () => firstValueFrom(this.api.subscribeDevice(device)),
      'This server no longer sends notifications.',
    );
    if (result !== 'done') {
      if (pending) {
        await this.notes.write(pending).catch(() => undefined);
      }
      // A subscription the server does not know would show the switch on and never notify.
      await within(UNSUBSCRIBE_TIMEOUT_MS, subscription.unsubscribe()).catch(() => false);
      this.subscription.set(null);
      return result;
    }
    if (pending) {
      this.givenUp.set(null);
    }
    this.subscription.set(subscription);
    return result;
  }

  private async current(
    registration?: ServiceWorkerRegistration | null,
  ): Promise<PushSubscription | null> {
    const from =
      registration === undefined ? await this.registration().catch(() => null) : registration;
    return (await from?.pushManager?.getSubscription().catch(() => null)) ?? null;
  }

  private async finishRemoval(): Promise<void> {
    const note = await this.notes.read().catch(() => undefined);
    if (!note) {
      return;
    }
    this.givenUp.set(note.endpoint);
    if (!(await this.endAtThePushService(note))) {
      return;
    }
    try {
      await firstValueFrom(this.api.removeSubscription(note));
    } catch {
      return;
    }
    await this.notes.clear(note).catch(() => undefined);
  }

  private async endAtThePushService(note: RemovalNote): Promise<boolean> {
    const current = await this.current();
    if (current?.endpoint !== note.endpoint) {
      return true;
    }
    return within(UNSUBSCRIBE_TIMEOUT_MS, current.unsubscribe()).then(
      (ended) => ended,
      () => false,
    );
  }
}
