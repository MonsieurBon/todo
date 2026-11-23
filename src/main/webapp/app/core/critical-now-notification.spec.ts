import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodoApi } from '../api/todo-api';
import { CriticalNowNotification, PUSH_REGISTRATION } from './critical-now-notification';
import { RemovalNote, RemovalNotes } from './removal-note';
import { Writes } from './writes';

const MINE = 'https://fcm.googleapis.com/fcm/send/1';
const SERVER_KEY =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const OTHER_KEY =
  'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';

const bytes = (base64url: string) =>
  Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    .buffer;

describe('the Critical Now notification', () => {
  let held: (PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> }) | null;
  let registration: {
    pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
    getNotifications: ReturnType<typeof vi.fn>;
  } | null;
  let api: {
    pushKey: ReturnType<typeof vi.fn>;
    subscribeDevice: ReturnType<typeof vi.fn>;
    removeSubscription: ReturnType<typeof vi.fn>;
  };
  let note: RemovalNote | undefined;
  let notes: {
    read: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let shown: { close: ReturnType<typeof vi.fn> }[];
  let order: string[];

  const device = (endpoint = MINE, key = SERVER_KEY) => {
    const made = {
      endpoint,
      options: { applicationServerKey: bytes(key) },
      toJSON: () => ({ endpoint, keys: { p256dh: 'P256DH', auth: 'AUTH' } }),
      unsubscribe: vi.fn(async () => {
        order.push('unsubscribe');
        if (held === made) {
          held = null;
        }
        return true;
      }),
    } as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> };
    return made;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const setUp = (enabled = true, pushApi = true) => {
    vi.stubGlobal('PushManager', pushApi ? class {} : undefined);
    order = [];
    held = null;
    registration = {
      pushManager: {
        getSubscription: vi.fn(async () => held),
        subscribe: vi.fn(async () => {
          held = device();
          return held;
        }),
      },
      getNotifications: vi.fn(async () => shown),
    };
    api = {
      pushKey: vi.fn(() => of({ publicKey: SERVER_KEY })),
      subscribeDevice: vi.fn(() => of(undefined)),
      removeSubscription: vi.fn(() => {
        order.push('remove');
        return of(undefined);
      }),
    };
    note = undefined;
    notes = {
      read: vi.fn(async () => note),
      write: vi.fn(async (n: RemovalNote) => {
        order.push('note');
        note = n;
      }),
      clear: vi.fn(async (n: RemovalNote) => {
        if (note?.endpoint === n.endpoint) {
          note = undefined;
        }
      }),
    };
    shown = [{ close: vi.fn(() => order.push('close')) }];
    TestBed.configureTestingModule({
      providers: [
        { provide: SwPush, useValue: { isEnabled: enabled } },
        { provide: PUSH_REGISTRATION, useValue: async () => registration },
        { provide: TodoApi, useValue: api },
        { provide: RemovalNotes, useValue: notes },
      ],
    });
    return TestBed.inject(CriticalNowNotification);
  };

  describe('being offered', () => {
    it('is offered once the server has said which key to subscribe with', async () => {
      const notification = setUp();
      expect(notification.available()).toBe(false);

      await notification.start(true);

      expect(notification.available()).toBe(true);
      expect(notification.on()).toBe(false);
    });

    it('is not offered by a server that sends no notifications', async () => {
      const notification = setUp();
      api.pushKey.mockReturnValue(of({ publicKey: null }));

      await notification.start(true);

      expect(notification.available()).toBe(false);
    });

    it('is not offered without a service worker, and asks the server nothing', async () => {
      const notification = setUp(false);

      await notification.start(true);
      await notification.forget();

      expect(notification.available()).toBe(false);
      expect(api.pushKey).not.toHaveBeenCalled();
    });

    it('is not offered by a browser without the Push API, and asks the server nothing', async () => {
      const notification = setUp(true, false);

      await notification.start(true);
      await notification.forget();

      expect(notification.available()).toBe(false);
      expect(api.pushKey).not.toHaveBeenCalled();
    });

    it('stays visible while offline on a device that has it on, so it can be turned off', async () => {
      const notification = setUp();
      api.pushKey.mockReturnValue(throwError(() => ({ status: 0 })));
      held = device();

      await notification.start(true);

      expect(notification.available()).toBe(true);
      expect(notification.on()).toBe(true);
    });
  });

  describe('turning it on', () => {
    it('subscribes with the server key and registers the device', async () => {
      const notification = setUp();
      await notification.start(true);

      expect(await notification.turnOn()).toBe('done');

      expect(registration!.pushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: new Uint8Array(bytes(SERVER_KEY)),
      });
      expect(api.subscribeDevice).toHaveBeenCalledWith({
        endpoint: MINE,
        p256dh: 'P256DH',
        auth: 'AUTH',
      });
      expect(notification.on()).toBe(true);
    });

    it('says so when the browser will not show notifications', async () => {
      const notification = setUp();
      await notification.start(true);
      registration!.pushManager.subscribe.mockRejectedValue(
        new DOMException('denied', 'NotAllowedError'),
      );

      expect(await notification.turnOn()).toBe('refused');

      expect(TestBed.inject(Writes).problem()).toContain('blocked');
      expect(api.subscribeDevice).not.toHaveBeenCalled();
    });

    it('says so when the browser cannot subscribe for another reason', async () => {
      const notification = setUp();
      await notification.start(true);
      registration!.pushManager.subscribe.mockRejectedValue(new DOMException('no', 'AbortError'));

      expect(await notification.turnOn()).toBe('refused');

      expect(TestBed.inject(Writes).problem()).toContain('could not be turned on');
    });

    it('says so before the worker is there to subscribe with', async () => {
      const notification = setUp();
      await notification.start(true);
      registration = null;

      expect(await notification.turnOn()).toBe('refused');

      expect(TestBed.inject(Writes).problem()).toContain('setting itself up');
    });

    it('drops the subscription again when the server could not be told, so the switch tells the truth', async () => {
      const notification = setUp();
      await notification.start(true);
      api.subscribeDevice.mockReturnValue(throwError(() => ({ status: 0 })));

      expect(await notification.turnOn()).toBe('refused');

      expect(order).toContain('unsubscribe');
      expect(notification.on()).toBe(false);
      expect(TestBed.inject(Writes).problem()).toContain('connection');
    });

    it('takes back a removal still pending for the subscription the browser hands back', async () => {
      const notification = setUp();
      const kept = device();
      kept.unsubscribe.mockRejectedValue(new DOMException('offline', 'NetworkError'));
      held = kept;
      await notification.forget();
      await notification.start(true);
      expect(notification.on()).toBe(false);
      registration!.pushManager.subscribe.mockResolvedValue(kept);

      await notification.turnOn();

      expect(note).toBeUndefined();
      expect(notification.on()).toBe(true);
    });

    it('takes that removal back before the server is told, whose first push would find it', async () => {
      const notification = setUp();
      const kept = device();
      kept.unsubscribe.mockRejectedValue(new DOMException('offline', 'NetworkError'));
      held = kept;
      await notification.forget();
      await notification.start(true);
      registration!.pushManager.subscribe.mockResolvedValue(kept);
      let noteWhenTold: RemovalNote | undefined;
      api.subscribeDevice.mockImplementation(() => {
        noteWhenTold = note;
        return of(undefined);
      });

      await notification.turnOn();

      expect(noteWhenTold).toBeUndefined();
    });

    it('notes that removal again when the server could not be told', async () => {
      const notification = setUp();
      const kept = device();
      kept.unsubscribe.mockRejectedValue(new DOMException('offline', 'NetworkError'));
      held = kept;
      await notification.forget();
      await notification.start(true);
      registration!.pushManager.subscribe.mockResolvedValue(kept);
      api.subscribeDevice.mockReturnValue(throwError(() => ({ status: 0 })));

      expect(await notification.turnOn()).toBe('refused');

      expect(note).toEqual({ endpoint: MINE, auth: 'AUTH' });
      expect(notification.on()).toBe(false);
    });
  });

  describe('on start', () => {
    it('registers a device that has it on again, which brings a dismissed notification back', async () => {
      const notification = setUp();
      held = device('https://fcm.googleapis.com/fcm/send/mine');

      await notification.start(true);

      expect(api.subscribeDevice).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/mine' }),
      );
    });

    it('says nothing when that fails: the next start tries again', async () => {
      const notification = setUp();
      held = device();
      api.subscribeDevice.mockReturnValue(throwError(() => ({ status: 0 })));

      await notification.start(true);

      expect(TestBed.inject(Writes).problem()).toBeNull();
      expect(notification.on()).toBe(true);
    });

    it('registers nothing on a device that has it off', async () => {
      const notification = setUp();

      await notification.start(true);

      expect(api.subscribeDevice).not.toHaveBeenCalled();
    });

    it('moves a device subscribed with a key the server no longer has to the one it has', async () => {
      const notification = setUp();
      held = device('https://fcm.googleapis.com/fcm/send/old', OTHER_KEY);

      await notification.start(true);

      expect(api.removeSubscription).toHaveBeenCalledWith({
        endpoint: 'https://fcm.googleapis.com/fcm/send/old',
        auth: 'AUTH',
      });
      expect(api.subscribeDevice).toHaveBeenCalledTimes(1);
      expect(api.subscribeDevice).toHaveBeenCalledWith(expect.objectContaining({ endpoint: MINE }));
      expect(notification.on()).toBe(true);
    });

    it('makes the move quietly: nobody asked, so a failure only leaves it off', async () => {
      const notification = setUp();
      held = device('https://fcm.googleapis.com/fcm/send/old', OTHER_KEY);
      registration!.pushManager.subscribe.mockRejectedValue(
        new DOMException('needs a gesture', 'NotAllowedError'),
      );

      await notification.start(true);

      expect(TestBed.inject(Writes).problem()).toBeNull();
      expect(notification.on()).toBe(false);
    });

    it('takes it off a device whose server no longer sends notifications', async () => {
      const notification = setUp();
      held = device();
      api.pushKey.mockReturnValue(of({ publicKey: null }));

      await notification.start(true);

      expect(api.removeSubscription).toHaveBeenCalledWith({ endpoint: MINE, auth: 'AUTH' });
      expect(order).toContain('close');
      expect(notification.on()).toBe(false);
      expect(notification.available()).toBe(false);
    });

    it('finishes a removal left by a sign-out, signed in or not', async () => {
      const notification = setUp();
      note = { endpoint: MINE, auth: 'AUTH' };

      await notification.start(false);

      expect(api.removeSubscription).toHaveBeenCalledWith({ endpoint: MINE, auth: 'AUTH' });
      expect(note).toBeUndefined();
      expect(api.pushKey).not.toHaveBeenCalled();
    });

    it('ends a subscription a signed-out start finds with no note, however the session ended', async () => {
      const notification = setUp();
      held = device();

      await notification.start(false);

      expect(order).toEqual(['note', 'unsubscribe', 'close', 'remove']);
      expect(api.removeSubscription).toHaveBeenCalledWith({ endpoint: MINE, auth: 'AUTH' });
      expect(note).toBeUndefined();
      expect(notification.on()).toBe(false);
    });

    it('ends a subscription the sign-out could not end, before telling the server', async () => {
      const notification = setUp();
      held = device();
      note = { endpoint: MINE, auth: 'AUTH' };

      await notification.start(true);

      expect(order).toEqual(['unsubscribe', 'remove']);
      expect(api.subscribeDevice).not.toHaveBeenCalled();
    });

    it('keeps the note while the push service or the server cannot be reached', async () => {
      const notification = setUp();
      const kept = device();
      kept.unsubscribe.mockRejectedValue(new DOMException('offline', 'NetworkError'));
      held = kept;
      note = { endpoint: MINE, auth: 'AUTH' };

      await notification.start(true);
      expect(api.removeSubscription).not.toHaveBeenCalled();
      expect(note).toBeDefined();

      kept.unsubscribe.mockResolvedValue(true);
      api.removeSubscription.mockReturnValue(throwError(() => ({ status: 0 })));
      await notification.start(true);
      expect(note).toBeDefined();
    });
  });

  describe('signing out', () => {
    it('notes the removal first, then ends the subscription, then closes what is shown', async () => {
      const notification = setUp();
      held = device();

      await notification.forget();

      expect(order).toEqual(['note', 'unsubscribe', 'close']);
      expect(note).toEqual({ endpoint: MINE, auth: 'AUTH' });
      expect(notification.on()).toBe(false);
    });

    it('never asks the server: the session is going, and so may the connection', async () => {
      const notification = setUp();
      held = device();

      await notification.forget();

      expect(api.removeSubscription).not.toHaveBeenCalled();
      expect(api.subscribeDevice).not.toHaveBeenCalled();
    });

    it('still closes what is shown, and shows it off, when the push service cannot be reached', async () => {
      const notification = setUp();
      held = device();
      held.unsubscribe.mockRejectedValue(new DOMException('offline', 'NetworkError'));
      await notification.start(true);

      await notification.forget();

      expect(shown[0].close).toHaveBeenCalled();
      expect(notification.on()).toBe(false);
      expect(note).toBeDefined();
    });

    it('closes a notification left behind even on a device with nothing to unsubscribe', async () => {
      const notification = setUp();

      await notification.forget();

      expect(shown[0].close).toHaveBeenCalled();
      expect(notes.write).not.toHaveBeenCalled();
    });

    it('ends even on a page no worker controls, where the registration has nothing to say', async () => {
      const notification = setUp();
      registration = null;

      await expect(notification.forget()).resolves.toBeUndefined();
    });

    it('ends even when the push service never answers', async () => {
      vi.useFakeTimers();
      try {
        const notification = setUp();
        held = device();
        held.unsubscribe.mockReturnValue(new Promise(() => undefined));

        const done = notification.forget();
        await vi.advanceTimersByTimeAsync(3000);

        await expect(done).resolves.toBeUndefined();
        expect(shown[0].close).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('turning it off', () => {
    it('shows it off even when the browser had already dropped the subscription', async () => {
      const notification = setUp();
      held = device();
      await notification.start(true);
      held = null;

      await notification.turnOff();

      expect(notification.on()).toBe(false);
    });

    it('does what signing out does, and finishes at once when it can', async () => {
      const notification = setUp();
      held = device();
      await notification.start(true);

      await notification.turnOff();

      expect(order).toEqual(['note', 'unsubscribe', 'close', 'remove']);
      expect(note).toBeUndefined();
      expect(notification.on()).toBe(false);
    });
  });
});
