import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthConfig, OAuthErrorEvent, OAuthService } from 'angular-oauth2-oidc';
import { Outbox } from '../offline/outbox';

const ISSUER_KEY = 'todo.issuer';

/**
 * In `localStorage`, not `sessionStorage`: the tab being closed at the login form is the very case
 * this catches, and the outbox it guards is origin-wide.
 */
const RECOVERING_FROM_KEY = 'todo.recovering-from';

/** Tab-scoped on purpose: one burst of redirects, not an identity. */
const LAST_RECOVERY_KEY = 'todo.recovered-at';

/** Long enough for a refusal that reproduces on the new token, short enough to retry much later. */
const RECOVERY_COOLDOWN_MS = 30_000;

const CLIENT_ID = 'todo-web';

/**
 * No `todo:` scope is named here on purpose: the IdP grants it by default, so a bundle cached in a
 * browser can never pin a scope name that the realm has since renamed — which would be refused at
 * the authorization request, before there is any session to recover from.
 *
 * `offline_access` matters: without it the refresh token dies with Keycloak's SSO idle timeout.
 */
const SCOPES = 'openid profile email offline_access';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oauth = inject(OAuthService);
  private readonly outbox = inject(Outbox);

  private readonly ready = signal(false);
  private readonly session = signal(false);
  private refreshing: Promise<boolean> | null = null;
  private startingOver = false;

  readonly resolved = this.ready.asReadonly();

  /**
   * Whether this device holds a session, not whether the access token is valid: launched with no
   * connection the token has usually expired, and a login page they cannot reach is a dead end.
   */
  readonly signedIn = this.session.asReadonly();

  readonly displayName = computed(() => {
    const claims = this.oauth.getIdentityClaims() as Record<string, string> | null;
    return claims?.['email'] ?? claims?.['preferred_username'] ?? null;
  });

  async bootstrap(): Promise<void> {
    const issuer = await this.resolveIssuer();
    if (!issuer) {
      this.ready.set(true);
      return;
    }
    this.oauth.configure(this.config(issuer));
    this.watchForRefusal();
    try {
      await this.oauth.loadDiscoveryDocumentAndTryLogin();
      if (!this.oauth.hasValidAccessToken() && this.oauth.getRefreshToken()) {
        await this.renew();
      }
      this.oauth.setupAutomaticSilentRefresh();
    } catch {
      // Launched with no connection. Whatever is in storage still identifies the user, and the
      // board renders from the service worker's cache; the first write goes to the outbox.
    }
    try {
      await this.settleOutboxOwnership();
    } catch {
      // Not the offline path above: the queue could not be proven safe to send, so this load gets
      // no board to flush it from. The marker stays and the next start settles it.
      this.oauth.logOut(true);
    }
    this.session.set(this.oauth.hasValidAccessToken() || !!this.oauth.getRefreshToken());
    this.ready.set(true);
  }

  accessToken(): string | null {
    return this.oauth.getAccessToken() || null;
  }

  signIn(returnUrl: string): void {
    this.oauth.initCodeFlow(returnUrl);
  }

  /** Consumed once. */
  takeReturnUrl(): string | null {
    const state = this.oauth.state;
    if (!state) {
      return null;
    }
    this.oauth.state = '';
    return decodeURIComponent(state);
  }

  /** Concurrent attempts are collapsed: each racing its own refresh invalidates the others. */
  tryRefresh(): Promise<boolean> {
    if (!this.oauth.getRefreshToken()) {
      return this.startOver().then(() => false);
    }
    this.refreshing ??= this.renew().finally(() => setTimeout(() => (this.refreshing = null)));
    return this.refreshing;
  }

  /**
   * The expiry timer renews inside the library, never through {@link renew}, so without this an
   * idle tab only discovers a dead session when the user acts. Our own failures raise it too; the
   * second recovery is a no-op.
   */
  private watchForRefusal(): void {
    this.oauth.events.subscribe((event) => {
      if (
        event.type === 'token_refresh_error' &&
        AuthService.refused((event as OAuthErrorEvent).reason)
      ) {
        void this.startOver();
      }
    });
  }

  /** A refusal ends the session here, rather than asking again with the same dead token for ever. */
  private async renew(): Promise<boolean> {
    try {
      await this.oauth.refreshToken();
      return true;
    } catch (error) {
      if (AuthService.refused(error)) {
        await this.startOver();
      }
      return false;
    }
  }

  /**
   * Both halves matter: a proxy in front of the IdP answers 400 and 401 too, but without an OAuth
   * error code. Mistaking one of those for a refusal deletes the offline board and then strands
   * the device at an IdP it cannot reach.
   */
  private static refused(error: unknown): boolean {
    const answer = error as { status?: number; error?: { error?: string } } | null;
    const named = typeof answer?.error?.error === 'string' && answer.error.error.length > 0;
    return (answer?.status === 400 || answer?.status === 401) && named;
  }

  /**
   * The IdP's own session is left alone deliberately: ending it would need the session that is
   * gone, and leaving it is what lets a merely revoked token come back without a login form.
   */
  private async startOver(): Promise<void> {
    if (this.startingOver) {
      return;
    }
    this.startingOver = true;
    // A cache that will not drop must not strand the sign-in; some private modes throw here.
    await this.forgetCaches().catch(() => undefined);
    this.session.set(false);
    // Read before logOut, which takes the claims with it.
    localStorage.setItem(RECOVERING_FROM_KEY, this.subject() ?? '');
    this.oauth.logOut(true);
    if (this.loopingOnRecovery()) {
      return;
    }
    this.signIn(location.pathname + location.search);
  }

  /**
   * The in-memory guard cannot see past the navigation it performs, so a refusal that reproduces
   * on the fresh token would redirect for ever. Stopping leaves the signed-out state and its Sign
   * in button: a dead end someone can act on beats a loop they cannot.
   */
  private loopingOnRecovery(): boolean {
    const previous = Number(sessionStorage.getItem(LAST_RECOVERY_KEY) ?? 0);
    sessionStorage.setItem(LAST_RECOVERY_KEY, String(Date.now()));
    return Date.now() - previous < RECOVERY_COOLDOWN_MS;
  }

  /**
   * Whoever answers the login form gets the device, so queued writes go unless the subject that
   * comes back is the one that left.
   *
   * <p>The answer waits for a session to resolve rather than being taken on the first start back:
   * abandoning the form is ordinary, and deciding there would destroy the user's own unsynced
   * writes. Nothing can leak meanwhile — flushing needs a board, and the board needs a session.
   */
  private async settleOutboxOwnership(): Promise<void> {
    const before = localStorage.getItem(RECOVERING_FROM_KEY);
    if (before === null) {
      return;
    }
    if (!this.oauth.hasValidAccessToken() && !this.oauth.getRefreshToken()) {
      return;
    }
    const after = this.subject();
    if (!before || !after || before !== after) {
      await this.outbox.clear();
    }
    // Last, so a queue that could not be dropped is settled again on the next start.
    localStorage.removeItem(RECOVERING_FROM_KEY);
  }

  private subject(): string | null {
    const claims = this.oauth.getIdentityClaims() as Record<string, string> | null;
    return claims?.['sub'] ?? null;
  }

  /** Caches and outbox go too: leaving either behind shows one person's list to the next. */
  async signOut(): Promise<void> {
    await this.forgetCaches();
    this.session.set(false);
    this.oauth.logOut();
  }

  private async forgetCaches(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.includes('ngsw')).map((n) => caches.delete(n)));
  }

  /**
   * Asked rather than baked into the bundle: the RFC 9728 metadata published for MCP clients is
   * the one place an environment's issuer is written down. Remembered for a cold start offline.
   */
  private async resolveIssuer(): Promise<string | null> {
    try {
      const response = await fetch('/.well-known/oauth-protected-resource');
      const metadata = (await response.json()) as { authorization_servers?: string[] };
      const issuer = metadata.authorization_servers?.[0];
      if (issuer) {
        localStorage.setItem(ISSUER_KEY, issuer);
        return issuer;
      }
    } catch {
      // Offline, or the API is down. Fall through to what was learned last time.
    }
    return localStorage.getItem(ISSUER_KEY);
  }

  private config(issuer: string): AuthConfig {
    return {
      issuer,
      clientId: CLIENT_ID,
      responseType: 'code',
      scope: SCOPES,
      redirectUri: location.origin + '/',
      postLogoutRedirectUri: location.origin + '/',
      // Localhost is served over http in development; anything else must be TLS.
      requireHttps: 'remoteOnly',
      // Third-party cookie policies break iframe-based renewal when the IdP is on another origin.
      useSilentRefresh: false,
      sessionChecksEnabled: false,
      clearHashAfterLogin: true,
      // Renew at three quarters of the token's life, so a slow network still has room.
      timeoutFactor: 0.75,
    };
  }
}
