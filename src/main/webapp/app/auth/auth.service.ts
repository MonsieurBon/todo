import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthConfig, OAuthService } from 'angular-oauth2-oidc';

/** Where the app remembers which authorization server to talk to, for a cold start with no signal. */
const ISSUER_KEY = 'todo.issuer';

const CLIENT_ID = 'todo-web';

/**
 * The app's own scopes. {@code offline_access} is what makes this usable on a phone: without it a
 * refresh token dies with Keycloak's SSO idle timeout, and a to-do list you have to log into every
 * morning is a to-do list you stop opening.
 */
const SCOPES = 'openid profile email offline_access todo:read todo:write todo:admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oauth = inject(OAuthService);

  private readonly ready = signal(false);
  private readonly session = signal(false);
  private refreshing: Promise<boolean> | null = null;

  /** True once bootstrap has decided; the shell renders nothing conclusive before this. */
  readonly resolved = this.ready.asReadonly();

  /**
   * Whether this device holds a session — not whether the access token is currently valid.
   *
   * <p>The difference is the whole point of installing this: launched with no connection, the
   * token in storage has usually expired and cannot be renewed, but the person is still logged in
   * and should see their board. Redirecting them to a login page they cannot reach would be the
   * one failure that makes an offline app pointless.
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
    try {
      await this.oauth.loadDiscoveryDocumentAndTryLogin();
      if (!this.oauth.hasValidAccessToken() && this.oauth.getRefreshToken()) {
        await this.oauth.refreshToken().catch(() => undefined);
      }
      this.oauth.setupAutomaticSilentRefresh();
    } catch {
      // Launched with no connection. Whatever is in storage still identifies the user, and the
      // board renders from the service worker's cache; the first write goes to the outbox.
    }
    this.session.set(this.oauth.hasValidAccessToken() || !!this.oauth.getRefreshToken());
    this.ready.set(true);
  }

  accessToken(): string | null {
    return this.oauth.getAccessToken() || null;
  }

  /** Sends the browser to the IdP, remembering where the person was going. */
  signIn(returnUrl: string): void {
    this.oauth.initCodeFlow(returnUrl);
  }

  /** The route the login interrupted, if any. Consumed once. */
  takeReturnUrl(): string | null {
    const state = this.oauth.state;
    if (!state) {
      return null;
    }
    this.oauth.state = '';
    return decodeURIComponent(state);
  }

  /**
   * Renews the access token, collapsing concurrent attempts: a board screen fires several requests
   * at once, and each one racing its own refresh would invalidate the others' rotated token.
   */
  tryRefresh(): Promise<boolean> {
    if (!this.oauth.getRefreshToken()) {
      return Promise.resolve(false);
    }
    this.refreshing ??= this.oauth
      .refreshToken()
      .then(() => true)
      .catch(() => false)
      .finally(() => setTimeout(() => (this.refreshing = null)));
    return this.refreshing;
  }

  /**
   * Ends the session everywhere it is remembered.
   *
   * <p>The service worker has cached board responses and the outbox may hold unsent tasks; leaving
   * either behind would show one person's list to the next.
   */
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
   * Asks the API which authorization server it trusts, rather than baking one into the bundle.
   *
   * <p>RFC 9728 metadata is already published for the MCP clients, is unauthenticated, and is
   * already covered by tests — so it is the one place an environment's issuer is written down.
   * The answer is remembered, because a cold start with no connection still needs it.
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
      // The refresh token is the mechanism, not a hidden iframe: third-party cookie policies
      // break iframe-based silent renewal whenever the IdP is on another origin, which it is.
      useSilentRefresh: false,
      sessionChecksEnabled: false,
      clearHashAfterLogin: true,
      // Renew at three quarters of the token's life, so a slow network still has room.
      timeoutFactor: 0.75,
    };
  }
}
