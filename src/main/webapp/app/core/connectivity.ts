import { Injectable, computed, signal } from '@angular/core';

/**
 * Whether the server can actually be reached.
 *
 * <p>Two signals, because neither is enough alone. {@code navigator.onLine} only knows whether
 * there is a network interface — it is true on a captive portal and true when the server is down.
 * And once a service worker is serving the board from its cache, a successful response proves
 * nothing either: offline looks exactly like online, which is how a stale board ends up on screen
 * with nothing saying so.
 *
 * <p>So reachability is measured against a URL the service worker deliberately does not cache. It
 * is a hint for the UI and a trigger for the outbox, never a precondition: every write is
 * attempted regardless and queued when it fails.
 */
@Injectable({ providedIn: 'root' })
export class Connectivity {
  /**
   * Public, uncached, and cheap — the protected resource metadata is served for the MCP clients
   * and is not in any of the service worker's groups, so a response to it came from the network.
   */
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

  /** Asks whether anything is actually answering, and remembers the answer. */
  async probe(): Promise<boolean> {
    try {
      const response = await fetch(Connectivity.PROBE, { cache: 'no-store' });
      this.serverReachable.set(response.ok);
    } catch {
      this.serverReachable.set(false);
    }
    return this.serverReachable();
  }

  /** Calls back whenever the device comes back, or the app is brought to the foreground. */
  onReconnect(handler: () => void): void {
    addEventListener('online', handler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handler();
      }
    });
  }
}
