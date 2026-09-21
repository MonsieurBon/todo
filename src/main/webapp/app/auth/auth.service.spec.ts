import { TestBed } from '@angular/core/testing';
import { OAuthErrorEvent, OAuthService } from 'angular-oauth2-oidc';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Outbox } from '../offline/outbox';
import { AuthService } from './auth.service';

/**
 * The way back from a dead session. A token the IdP refuses must not leave the device on a board
 * that answers 401 for ever; a token that merely could not be sent must not sign the device out,
 * because offline every request fails and the cached board is the whole point.
 */
describe('a session whose token is refused', () => {
  /** Keycloak's answer to a refresh token that is revoked, expired, or from a realm since changed. */
  const invalidGrant = { status: 400, error: { error: 'invalid_grant' } };

  let oauth: Record<string, ReturnType<typeof vi.fn>>;
  let outbox: Record<string, ReturnType<typeof vi.fn>>;
  let events: Subject<unknown>;
  let auth: AuthService;

  const signedInAs = (sub: string) => {
    oauth['getIdentityClaims'] = vi.fn(() => ({ sub, email: `${sub}@example.com` }));
  };

  /** A device that signed in earlier and whose access token has since expired. */
  const signedInDevice = async () => {
    oauth['hasValidAccessToken'] = vi.fn(() => true);
    await auth.bootstrap();
    oauth['hasValidAccessToken'] = vi.fn(() => false);
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    // jsdom has no `caches`, and a test that stubs one must not leave it for the next.
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authorization_servers: ['https://idp.example/realms/t'] }),
        }),
      ),
    );
    events = new Subject<unknown>();
    oauth = {
      events: events as unknown as ReturnType<typeof vi.fn>,
      configure: vi.fn(),
      loadDiscoveryDocumentAndTryLogin: vi.fn(() => Promise.resolve(true)),
      setupAutomaticSilentRefresh: vi.fn(),
      hasValidAccessToken: vi.fn(() => false),
      getRefreshToken: vi.fn(() => 'stored'),
      getAccessToken: vi.fn(() => 'stale'),
      getIdentityClaims: vi.fn(() => null),
      refreshToken: vi.fn(() => Promise.resolve({})),
      initCodeFlow: vi.fn(),
      // As the real one does: every stored token goes, so nothing is left to look signed in with.
      logOut: vi.fn(() => {
        oauth['getRefreshToken'] = vi.fn(() => null);
        oauth['hasValidAccessToken'] = vi.fn(() => false);
      }),
    };
    outbox = { clear: vi.fn(() => Promise.resolve()) };
    auth = configure();
  });

  const configure = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: OAuthService, useValue: oauth },
        { provide: Outbox, useValue: outbox },
      ],
    });
    return TestBed.inject(AuthService);
  };

  /** A page load: what the service held in memory is gone, what it put in storage is not. */
  const afterNavigation = () => {
    TestBed.resetTestingModule();
    return configure();
  };

  it('clears the tokens and asks the IdP again, returning to the page they were on', async () => {
    await signedInDevice();
    oauth['refreshToken'] = vi.fn(() => Promise.reject(invalidGrant));

    await expect(auth.tryRefresh()).resolves.toBe(false);

    // Locally only: an end-session round trip would need the very session that is gone.
    expect(oauth['logOut']).toHaveBeenCalledWith(true);
    expect(oauth['initCodeFlow']).toHaveBeenCalledWith(location.pathname + location.search);
    expect(auth.signedIn()).toBe(false);
  });

  it.each([
    ['no network', { status: 0 }],
    ['the IdP is down', { status: 503 }],
    // In front of the IdP rather than the IdP: no OAuth error code, so nothing was refused.
    ['a proxy rejecting the request', { status: 400 }],
    ['a gateway answering with an html body', { status: 401, error: 'Unauthorized' }],
  ])('stays signed in when the refresh never got an answer: %s', async (_reason, rejection) => {
    await signedInDevice();
    oauth['refreshToken'] = vi.fn(() => Promise.reject(rejection));

    await expect(auth.tryRefresh()).resolves.toBe(false);

    expect(oauth['logOut']).not.toHaveBeenCalled();
    expect(oauth['initCodeFlow']).not.toHaveBeenCalled();
    expect(auth.signedIn()).toBe(true);
  });

  it('signs in anyway when the caches refuse to drop', async () => {
    vi.stubGlobal('caches', {
      keys: () => Promise.reject(new Error('storage is not available in this mode')),
    });
    await signedInDevice();
    oauth['refreshToken'] = vi.fn(() => Promise.reject(invalidGrant));

    await expect(auth.tryRefresh()).resolves.toBe(false);

    expect(oauth['initCodeFlow']).toHaveBeenCalled();
  });

  it('starts over when there is no refresh token left to renew with', async () => {
    await signedInDevice();
    oauth['getRefreshToken'] = vi.fn(() => null);

    await expect(auth.tryRefresh()).resolves.toBe(false);

    expect(oauth['initCodeFlow']).toHaveBeenCalled();
  });

  it('sends the device to the IdP once, however many requests are refused together', async () => {
    await signedInDevice();
    oauth['refreshToken'] = vi.fn(() => Promise.reject(invalidGrant));

    await Promise.all([auth.tryRefresh(), auth.tryRefresh(), auth.tryRefresh()]);

    expect(oauth['initCodeFlow']).toHaveBeenCalledTimes(1);
  });

  it('does not come back from a cold start as a session the IdP has already refused', async () => {
    oauth['refreshToken'] = vi.fn(() => Promise.reject(invalidGrant));

    await auth.bootstrap();

    expect(auth.resolved()).toBe(true);
    expect(auth.signedIn()).toBe(false);
    expect(oauth['initCodeFlow']).toHaveBeenCalled();
  });

  it('recovers when the refusal comes from the library’s own expiry timer', async () => {
    await signedInDevice();

    // What setupAutomaticSilentRefresh raises: it calls refreshToken itself, never through renew.
    events.next(new OAuthErrorEvent('token_refresh_error', invalidGrant));
    await vi.waitFor(() => expect(oauth['initCodeFlow']).toHaveBeenCalled());

    expect(auth.signedIn()).toBe(false);
  });

  it('leaves an idle tab signed in when that timer merely could not reach the IdP', async () => {
    await signedInDevice();

    events.next(new OAuthErrorEvent('token_refresh_error', { status: 0 }));

    expect(oauth['initCodeFlow']).not.toHaveBeenCalled();
    expect(auth.signedIn()).toBe(true);
  });

  it('stops redirecting when the refusal outlives the sign-in, rather than looping', async () => {
    await signedInDevice();
    oauth['refreshToken'] = vi.fn(() => Promise.reject(invalidGrant));
    await auth.tryRefresh();
    expect(oauth['initCodeFlow']).toHaveBeenCalledTimes(1);

    // Back from the IdP, and the fresh token is refused in exactly the same way.
    const reloaded = afterNavigation();
    await reloaded.tryRefresh();

    expect(oauth['initCodeFlow']).toHaveBeenCalledTimes(1);
    expect(reloaded.signedIn()).toBe(false);
  });

  /** Alice is signed in with writes queued, and her refresh token has just been refused. */
  const refusedWithWritesQueued = async () => {
    signedInAs('alice');
    await signedInDevice();
    oauth['refreshToken'] = vi.fn(() => Promise.reject(invalidGrant));
    await auth.tryRefresh();
  };

  /** Someone answers the login form: the code flow comes back with their tokens and claims. */
  const answersTheLoginForm = (sub: string) => {
    signedInAs(sub);
    oauth['loadDiscoveryDocumentAndTryLogin'] = vi.fn(() => {
      oauth['hasValidAccessToken'] = vi.fn(() => true);
      oauth['getRefreshToken'] = vi.fn(() => 'fresh');
      return Promise.resolve(true);
    });
  };

  it('throws the queued writes away when someone else answers the login form', async () => {
    await refusedWithWritesQueued();

    // Alice's SSO session died with her refresh token, so Bob is who came back.
    answersTheLoginForm('bob');
    await afterNavigation().bootstrap();

    expect(outbox['clear']).toHaveBeenCalled();
  });

  it('throws them away even in a tab that never saw the refusal', async () => {
    await refusedWithWritesQueued();

    // Alice closed the tab at the login form; her queue outlives it, so the marker must too.
    sessionStorage.clear();
    answersTheLoginForm('bob');
    await afterNavigation().bootstrap();

    expect(outbox['clear']).toHaveBeenCalled();
  });

  it('keeps them when the same person signs back in, which is what recovery is for', async () => {
    await refusedWithWritesQueued();

    answersTheLoginForm('alice');
    await afterNavigation().bootstrap();

    expect(outbox['clear']).not.toHaveBeenCalled();
  });

  it('throws them away when a session resolves but nobody can be named', async () => {
    await refusedWithWritesQueued();

    answersTheLoginForm('bob');
    oauth['getIdentityClaims'] = vi.fn(() => null);
    await afterNavigation().bootstrap();

    expect(outbox['clear']).toHaveBeenCalled();
  });

  it('keeps them when she presses Back at the login form instead of signing in', async () => {
    await refusedWithWritesQueued();

    // No code in the URL and no tokens: nobody has claimed the device, so nothing is decided yet.
    await afterNavigation().bootstrap();

    expect(outbox['clear']).not.toHaveBeenCalled();
  });

  it('still decides once she does sign in, on the start that resolves a session', async () => {
    await refusedWithWritesQueued();
    await afterNavigation().bootstrap();

    answersTheLoginForm('bob');
    await afterNavigation().bootstrap();

    expect(outbox['clear']).toHaveBeenCalled();
  });

  it('signs the load out rather than leaving a queue it could not drop', async () => {
    await refusedWithWritesQueued();
    outbox['clear'] = vi.fn(() => Promise.reject(new Error('no indexeddb here')));

    answersTheLoginForm('bob');
    const reloaded = afterNavigation();
    await reloaded.bootstrap();

    expect(reloaded.signedIn()).toBe(false);
    // Still set, so the next start settles it rather than flushing Alice's writes for Bob.
    expect(localStorage.getItem('todo.recovering-from')).toBe('alice');
  });

  it('leaves the outbox alone on an ordinary start that is not a recovery', async () => {
    answersTheLoginForm('alice');

    await auth.bootstrap();

    expect(outbox['clear']).not.toHaveBeenCalled();
  });

  it('keeps a cold start offline signed in, so the board still renders from the cache', async () => {
    oauth['refreshToken'] = vi.fn(() => Promise.reject({ status: 0 }));

    await auth.bootstrap();

    expect(auth.signedIn()).toBe(true);
    expect(oauth['initCodeFlow']).not.toHaveBeenCalled();
  });
});
