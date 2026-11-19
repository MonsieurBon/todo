import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { PushDevice } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { WriteResult, Writes } from './writes';

const BLOCKED = 'Notifications are blocked for this app. Allow them in the browser’s settings.';

const asDevice = (subscription: PushSubscription): PushDevice => {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint: endpoint!, p256dh: keys!['p256dh'], auth: keys!['auth'] };
};

/**
 * Critical Now as a notification on this device. Whether it is on is whether the browser holds a
 * push subscription for this app: there is no flag of our own to disagree with it.
 */
@Injectable({ providedIn: 'root' })
export class CriticalNowNotification {
  private readonly push = inject(SwPush);
  private readonly api = inject(TodoApi);
  private readonly writes = inject(Writes);

  private readonly key = signal<string | null>(null);
  private readonly subscription = toSignal(this.push.subscription, { initialValue: null });

  readonly on = computed(() => this.subscription() !== null);

  /** Also while offline on a device that has it on: switching it off must stay possible. */
  readonly available = computed(() => this.push.isEnabled && (this.key() !== null || this.on()));

  /**
   * Registering again on every start is what brings back a notification that was swiped away: the
   * server answers a registration with the current Critical Now.
   */
  async start(): Promise<void> {
    if (!this.push.isEnabled) {
      return;
    }
    try {
      this.key.set((await firstValueFrom(this.api.pushKey())).publicKey ?? null);
    } catch {
      // Offline. The key only matters for turning it on, which needs a connection anyway.
    }
    const current = await firstValueFrom(this.push.subscription);
    if (current) {
      await firstValueFrom(this.api.subscribeDevice(asDevice(current))).catch(() => undefined);
    }
  }

  async turnOn(): Promise<WriteResult> {
    const serverPublicKey = this.key();
    if (!serverPublicKey) {
      return 'refused';
    }
    let subscription: PushSubscription;
    try {
      subscription = await this.push.requestSubscription({ serverPublicKey });
    } catch (error) {
      if ((error as DOMException | null)?.name === 'NotAllowedError') {
        return this.writes.refuse(BLOCKED);
      }
      return this.writes.attempt(() => Promise.reject(error), BLOCKED);
    }
    const result = await this.writes.attempt(
      () => firstValueFrom(this.api.subscribeDevice(asDevice(subscription))),
      'This server no longer sends notifications.',
    );
    if (result !== 'done') {
      // A subscription the server does not know would show the switch on and never notify.
      await subscription.unsubscribe().catch(() => false);
    }
    return result;
  }
}
