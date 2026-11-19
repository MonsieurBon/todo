import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TodoApi } from '../api/todo-api';
import { CriticalNowNotification } from './critical-now-notification';
import { Writes } from './writes';

const device = (endpoint = 'https://fcm.googleapis.com/fcm/send/1') =>
  ({
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'P256DH', auth: 'AUTH' } }),
    unsubscribe: vi.fn(async () => true),
  }) as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> };

describe('the Critical Now notification', () => {
  let subscription: BehaviorSubject<PushSubscription | null>;
  let sw: {
    isEnabled: boolean;
    subscription: BehaviorSubject<PushSubscription | null>;
    requestSubscription: ReturnType<typeof vi.fn>;
  };
  let api: { pushKey: ReturnType<typeof vi.fn>; subscribeDevice: ReturnType<typeof vi.fn> };

  const setUp = (enabled = true) => {
    subscription = new BehaviorSubject<PushSubscription | null>(null);
    sw = {
      isEnabled: enabled,
      subscription,
      requestSubscription: vi.fn(async () => {
        const made = device();
        subscription.next(made);
        return made;
      }),
    };
    api = {
      pushKey: vi.fn(() => of({ publicKey: 'SERVER-KEY' })),
      subscribeDevice: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwPush, useValue: sw },
        { provide: TodoApi, useValue: api },
      ],
    });
    return TestBed.inject(CriticalNowNotification);
  };

  describe('being offered', () => {
    it('is offered once the server has said which key to subscribe with', async () => {
      const notification = setUp();
      expect(notification.available()).toBe(false);

      await notification.start();

      expect(notification.available()).toBe(true);
      expect(notification.on()).toBe(false);
    });

    it('is not offered by a server that sends no notifications', async () => {
      const notification = setUp();
      api.pushKey.mockReturnValue(of({ publicKey: null }));

      await notification.start();

      expect(notification.available()).toBe(false);
    });

    it('is not offered without a service worker, and asks the server nothing', async () => {
      const notification = setUp(false);
      sw.subscription = NEVER as unknown as BehaviorSubject<PushSubscription | null>;

      await notification.start();

      expect(notification.available()).toBe(false);
      expect(api.pushKey).not.toHaveBeenCalled();
    });

    it('stays visible while offline on a device that has it on, so it can be turned off', async () => {
      const notification = setUp();
      api.pushKey.mockReturnValue(throwError(() => ({ status: 0 })));
      subscription.next(device());

      await notification.start();

      expect(notification.available()).toBe(true);
      expect(notification.on()).toBe(true);
    });
  });

  describe('turning it on', () => {
    it('subscribes with the server key and registers the device', async () => {
      const notification = setUp();
      await notification.start();

      expect(await notification.turnOn()).toBe('done');

      expect(sw.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'SERVER-KEY' });
      expect(api.subscribeDevice).toHaveBeenCalledWith({
        endpoint: 'https://fcm.googleapis.com/fcm/send/1',
        p256dh: 'P256DH',
        auth: 'AUTH',
      });
      expect(notification.on()).toBe(true);
    });

    it('says so when the browser will not show notifications', async () => {
      const notification = setUp();
      await notification.start();
      sw.requestSubscription.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

      expect(await notification.turnOn()).toBe('refused');

      expect(TestBed.inject(Writes).problem()).toContain('blocked');
      expect(api.subscribeDevice).not.toHaveBeenCalled();
    });

    it('drops the subscription again when the server could not be told, so the switch tells the truth', async () => {
      const notification = setUp();
      await notification.start();
      const made = device();
      sw.requestSubscription.mockResolvedValue(made);
      api.subscribeDevice.mockReturnValue(throwError(() => ({ status: 0 })));

      expect(await notification.turnOn()).toBe('refused');

      expect(made.unsubscribe).toHaveBeenCalled();
      expect(TestBed.inject(Writes).problem()).toContain('connection');
    });
  });

  describe('on start', () => {
    it('registers a device that has it on again, which brings a dismissed notification back', async () => {
      const notification = setUp();
      subscription.next(device('https://fcm.googleapis.com/fcm/send/mine'));

      await notification.start();

      expect(api.subscribeDevice).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/mine' }),
      );
    });

    it('says nothing when that fails: the next start tries again', async () => {
      const notification = setUp();
      subscription.next(device());
      api.subscribeDevice.mockReturnValue(throwError(() => ({ status: 0 })));

      await notification.start();

      expect(TestBed.inject(Writes).problem()).toBeNull();
      expect(notification.on()).toBe(true);
    });

    it('registers nothing on a device that has it off', async () => {
      const notification = setUp();

      await notification.start();

      expect(api.subscribeDevice).not.toHaveBeenCalled();
    });
  });
});
