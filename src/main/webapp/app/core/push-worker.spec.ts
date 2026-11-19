import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemovalNotes } from './removal-note';

/**
 * The worker is a plain script the browser loads as it is, so it is run here as it is too, against
 * a stand-in for the service worker's global scope. The note it reads is written by the page's own
 * code, so the two are held to the same store.
 */
const SOURCE = readFileSync('public/push-worker.js', 'utf8');

type Listener = (event: { data: unknown; waitUntil: (p: Promise<unknown>) => void }) => void;

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/mine';

const worker = (subscribed: { endpoint: string } | null = { endpoint: ENDPOINT }) => {
  const listeners = new Map<string, Listener>();
  const shown: { title: string; options: NotificationOptions }[] = [];
  const subscription = subscribed && { ...subscribed, unsubscribe: vi.fn(async () => true) };
  const scope = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    registration: {
      showNotification: vi.fn(async (title: string, options: NotificationOptions) => {
        shown.push({ title, options });
      }),
      pushManager: { getSubscription: vi.fn(async () => subscription) },
    },
  };
  const importScripts = vi.fn();
  new Function('self', 'importScripts', SOURCE)(scope, importScripts);

  const push = async (data: unknown) => {
    const pending: Promise<unknown>[] = [];
    listeners.get('push')!({
      data: data === undefined ? null : { json: () => data },
      waitUntil: (p) => pending.push(p),
    });
    await Promise.all(pending);
  };
  return { push, shown, importScripts, subscription };
};

const CRITICAL = { criticalNow: { title: 'Critical Now (2)', body: 'Pay rent\nCall the plumber' } };

describe('the push worker', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let notes: RemovalNotes;

  beforeEach(async () => {
    fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    notes = TestBed.inject(RemovalNotes);
    const left = await notes.read();
    if (left) {
      await notes.clear(left);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads Angular's worker, which does everything else", () => {
    expect(worker().importScripts).toHaveBeenCalledWith('./ngsw-worker.js');
  });

  it('shows Critical Now as the server wrote it, replacing the last one quietly', async () => {
    const w = worker();

    await w.push(CRITICAL);

    expect(w.shown).toHaveLength(1);
    expect(w.shown[0].title).toBe('Critical Now (2)');
    expect(w.shown[0].options).toMatchObject({
      body: 'Pay rent\nCall the plumber',
      tag: 'critical-now',
      renotify: false,
      silent: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the app when tapped, through Angular's click handling", async () => {
    const w = worker();

    await w.push(CRITICAL);

    expect(w.shown[0].options.data).toEqual({
      onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '/' } },
    });
  });

  it("leaves any other push to Angular's worker", async () => {
    const w = worker();

    await w.push({ notification: { title: 'Something else' } });
    await w.push(undefined);

    expect(w.shown).toEqual([]);
  });

  describe('on a device that has signed out or turned it off', () => {
    beforeEach(async () => {
      await notes.write({ endpoint: ENDPOINT, auth: 'AUTH' });
    });

    it('shows nothing: the titles must not reach whoever has the device now', async () => {
      const w = worker();

      await w.push(CRITICAL);

      expect(w.shown).toEqual([]);
    });

    it('ends the subscription and removes it from the server, now that it is online', async () => {
      const w = worker();

      await w.push(CRITICAL);

      expect(w.subscription!.unsubscribe).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        '/push/removal',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ endpoint: ENDPOINT, auth: 'AUTH' }),
        }),
      );
      expect(await notes.read()).toBeUndefined();
    });

    it('keeps the note when the server could not be told, for the next start to finish', async () => {
      fetchMock.mockRejectedValue(new TypeError('offline'));
      const w = worker();

      await w.push(CRITICAL);

      expect(await notes.read()).toEqual({ endpoint: ENDPOINT, auth: 'AUTH' });
    });

    it('shows a newer subscription its titles, and only tells the server about the old one', async () => {
      const w = worker({ endpoint: 'https://fcm.googleapis.com/fcm/send/newer' });

      await w.push(CRITICAL);

      expect(w.shown[0].title).toBe('Critical Now (2)');
      expect(w.subscription!.unsubscribe).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('/push/removal', expect.anything());
      expect(await notes.read()).toBeUndefined();
    });
  });
});
