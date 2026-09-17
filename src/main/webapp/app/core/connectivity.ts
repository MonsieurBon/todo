import { Injectable, computed, signal } from '@angular/core';

/**
 * `navigator.onLine` only knows there is an interface — true on a captive portal, true when the
 * server is down — and a cached 200 proves nothing either, so reachability is measured against a
 * URL the service worker does not cache.
 *
 * <p>A hint for the UI and a trigger for the outbox, never a precondition: writes are attempted
 * regardless and queued when they fail.
 */
@Injectable({ providedIn: 'root' })
export class Connectivity {
  /** In none of the service worker's groups, so a response to it came from the network. */
  private static readonly PROBE = '/.well-known/oauth-protected-resource';

  private readonly deviceOnline = signal(navigator.onLine);
  private readonly serverReachable = signal(navigator.onLine);

  readonly online = computed(() => this.deviceOnline() && this.serverReachable());

  constructor() {
    addEventListener('online', () => {
      this.deviceOnline.set(true);
      void this.probe();
    });
    addEventListener('offline', () => {
      this.deviceOnline.set(false);
      this.serverReachable.set(false);
    });
  }

  async probe(): Promise<boolean> {
    try {
      const response = await fetch(Connectivity.PROBE, { cache: 'no-store' });
      this.serverReachable.set(response.ok);
    } catch {
      this.serverReachable.set(false);
    }
    return this.serverReachable();
  }

  onReconnect(handler: () => void): void {
    addEventListener('online', handler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handler();
      }
    });
  }
}
