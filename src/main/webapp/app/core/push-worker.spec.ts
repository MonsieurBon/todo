import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The worker is a plain script the browser loads as it is, so it is run here as it is too, against
 * a stand-in for the service worker's global scope.
 */
const SOURCE = readFileSync('public/push-worker.js', 'utf8');

type Listener = (event: { data: unknown; waitUntil: (p: Promise<unknown>) => void }) => void;

const worker = () => {
  const listeners = new Map<string, Listener>();
  const shown: { title: string; options: NotificationOptions }[] = [];
  const scope = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    registration: {
      showNotification: vi.fn(async (title: string, options: NotificationOptions) => {
        shown.push({ title, options });
      }),
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
  return { push, shown, importScripts };
};

describe('the push worker', () => {
  let w: ReturnType<typeof worker>;

  beforeEach(() => {
    w = worker();
  });

  it("loads Angular's worker, which does everything else", () => {
    expect(w.importScripts).toHaveBeenCalledWith('./ngsw-worker.js');
  });

  it('shows Critical Now as the server wrote it, replacing the last one quietly', async () => {
    await w.push({
      criticalNow: { title: 'Critical Now (2)', body: 'Pay rent\nCall the plumber' },
    });

    expect(w.shown).toHaveLength(1);
    expect(w.shown[0].title).toBe('Critical Now (2)');
    expect(w.shown[0].options).toMatchObject({
      body: 'Pay rent\nCall the plumber',
      tag: 'critical-now',
      renotify: false,
      silent: true,
    });
  });

  it("opens the app when tapped, through Angular's click handling", async () => {
    await w.push({ criticalNow: { title: 'Critical Now (1)', body: 'Pay rent' } });

    expect(w.shown[0].options.data).toEqual({
      onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '/' } },
    });
  });

  it("leaves any other push to Angular's worker", async () => {
    await w.push({ notification: { title: 'Something else' } });
    await w.push(undefined);

    expect(w.shown).toEqual([]);
  });
});
