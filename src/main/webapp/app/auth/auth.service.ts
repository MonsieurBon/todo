import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthConfig, OAuthService } from 'angular-oauth2-oidc';

const ISSUER_KEY = 'todo.issuer';

const CLIENT_ID = 'todo-web';

/** `offline_access` matters: without it the refresh token dies with Keycloak's SSO idle timeout. */
const SCOPES = 'openid profile email offline_access todo:read todo:write todo:admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oauth = inject(OAuthService);

  private readonly ready = signal(false);
  private readonly session = signal(false);
  private refreshing: Promise<boolean> | null = null;

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
      return Promise.resolve(false);
    }
    this.refreshing ??= this.oauth
      .refreshToken()
      .then(() => true)
      .catch(() => false)
      .finally(() => setTimeout(() => (this.refreshing = null)));
    return this.refreshing;
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
