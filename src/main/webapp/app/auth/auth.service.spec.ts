import { TestBed } from '@angular/core/testing';
import { OAuthErrorEvent, OAuthService } from 'angular-oauth2-oidc';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Outbox } from '../offline/outbox';
import { AuthService } from './auth.service';

/** Enough of the library to boot, logging out the way the real one does: every stored token goes. */
const oauthDouble = (events: Subject<unknown>) => {
  const oauth: Record<string, ReturnType<typeof vi.fn>> = {
    events: events as unknown as ReturnType<typeof vi.fn>,
    configure: vi.fn(),
    loadDiscoveryDocumentAndTryLogin: vi.fn(() => Promise.resolve(true)),
    loadDiscoveryDocument: vi.fn(() => Promise.resolve({})),
    setupAutomaticSilentRefresh: vi.fn(),
    hasValidAccessToken: vi.fn(() => false),
    getRefreshToken: vi.fn(() => 'stored'),
    getAccessToken: vi.fn(() => 'stale'),
    getIdentityClaims: vi.fn(() => null),
    refreshToken: vi.fn(() => Promise.resolve({})),
    initCodeFlow: vi.fn(),
    logOut: vi.fn(() => {
      oauth['getRefreshToken'] = vi.fn(() => null);
      oauth['hasValidAccessToken'] = vi.fn(() => false);
    }),
  };
  return oauth;
};

const serviceWith = (
  oauth: Record<string, ReturnType<typeof vi.fn>>,
  outbox: Record<string, ReturnType<typeof vi.fn>> = { clear: vi.fn(() => Promise.resolve()) },
) => {
  TestBed.configureTestingModule({
    providers: [
      { provide: OAuthService, useValue: oauth },
      { provide: Outbox, useValue: outbox },
    ],
  });
  return TestBed.inject(AuthService);
};

/** jsdom has no `caches`, and a test that stubs one or spies on storage must not leave it behind. */
const freshBrowser = () => {
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ authorization_servers: ['https://idp.example/realms/t'] }),
      }),
    ),
  );
};

/**
 * Refuses the marker write and nothing else. It has to go through `Storage.prototype`, because
 * jsdom proxies the storage objects themselves and an own property on one becomes a stored item
 * rather than a replaced method — so the key is what narrows it, keeping `sessionStorage` working
 * and the recovery cooldown out of what these tests exercise.
 */
const markerWriteRefused = () => {
  const write = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (key === 'todo.recovering-from') {
      throw new DOMException('the quota has been exceeded', 'QuotaExceededError');
    }
    write.call(this, key, value);
  });
};

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
    freshBrowser();
    events = new Subject<unknown>();
    oauth = oauthDouble(events);
    outbox = { clear: vi.fn(() => Promise.resolve()) };
    auth = serviceWith(oauth, outbox);
  });

  /** A page load: what the service held in memory is gone, what it put in storage is not. */
  const afterNavigation = () => {
    TestBed.resetTestingModule();
    return serviceWith(oauth, outbox);
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

  it('signs in anyway when the marker cannot be written', async () => {
    await signedInDevice();
    oauth['refreshToken'] = vi.fn(() => Promise.reject(invalidGrant));
    markerWriteRefused();

    await expect(auth.tryRefresh()).resolves.toBe(false);

    // Without the tokens going and the form coming up, the device is stranded signed-out with a
    // live access token and no later refusal able to retry.
    expect(oauth['logOut']).toHaveBeenCalledWith(true);
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

/**
 * An outage that is over. Without discovery the library has no token endpoint and no login URL, so
 * a page that started while the IdP was unreachable must ask again, or it stays stranded until
 * someone thinks to reload it.
 */
describe('a start that could not reach the IdP', () => {
  let oauth: Record<string, ReturnType<typeof vi.fn>>;
  let auth: AuthService;

  const unreachable = () => Promise.reject({ status: 0 });

  beforeEach(async () => {
    freshBrowser();
    oauth = oauthDouble(new Subject<unknown>());
    oauth['loadDiscoveryDocumentAndTryLogin'] = vi.fn(unreachable);
    auth = serviceWith(oauth);
    await auth.bootstrap();
    expect(auth.signedIn()).toBe(true);
  });

  it('renews once the IdP is back, and keeps renewing on its own from then on', async () => {
    await expect(auth.tryRefresh()).resolves.toBe(true);

    expect(oauth['loadDiscoveryDocument']).toHaveBeenCalled();
    expect(oauth['refreshToken']).toHaveBeenCalled();
    expect(oauth['setupAutomaticSilentRefresh']).toHaveBeenCalled();
  });

  it('sets the renewal up once, however many renewals follow', async () => {
    await auth.tryRefresh();
    await new Promise((resolve) => setTimeout(resolve));
    await auth.tryRefresh();

    expect(oauth['setupAutomaticSilentRefresh']).toHaveBeenCalledTimes(1);
  });

  // Shaped exactly like a refusal, but from the discovery URL: never the token endpoint's verdict.
  it('stays signed in when something in front of the IdP answers discovery with 401', async () => {
    oauth['loadDiscoveryDocument'] = vi.fn(() =>
      Promise.reject({ status: 401, error: { error: 'invalid_token' } }),
    );

    await expect(auth.tryRefresh()).resolves.toBe(false);

    expect(oauth['logOut']).not.toHaveBeenCalled();
    expect(oauth['initCodeFlow']).not.toHaveBeenCalled();
    expect(auth.signedIn()).toBe(true);
  });

  it('stays signed in while the IdP is still unreachable, and asks again next time', async () => {
    oauth['loadDiscoveryDocument'] = vi.fn(unreachable);

    await expect(auth.tryRefresh()).resolves.toBe(false);
    await new Promise((resolve) => setTimeout(resolve));
    await auth.tryRefresh();

    expect(oauth['loadDiscoveryDocument']).toHaveBeenCalledTimes(2);
    expect(oauth['logOut']).not.toHaveBeenCalled();
    expect(auth.signedIn()).toBe(true);
  });

  it('asks once when a click and a renewal both need the IdP at the same time', async () => {
    auth.signIn('/');
    await auth.tryRefresh();

    expect(oauth['loadDiscoveryDocument']).toHaveBeenCalledTimes(1);
  });

  it('goes to the login form once the IdP answers', async () => {
    auth.signIn('/review');

    await vi.waitFor(() => expect(oauth['initCodeFlow']).toHaveBeenCalledWith('/review'));
  });

  it('does not go to the login form later, when the click is long forgotten', async () => {
    oauth['loadDiscoveryDocument'] = vi.fn(unreachable);
    auth.signIn('/');
    await new Promise((resolve) => setTimeout(resolve));

    // What would fire a redirect held by the library, had the click handed it one.
    oauth['loadDiscoveryDocument'] = vi.fn(() => Promise.resolve({}));
    await auth.tryRefresh();

    expect(oauth['initCodeFlow']).not.toHaveBeenCalled();
  });
});

describe('a start that reached the IdP', () => {
  it('does not ask for discovery again', async () => {
    freshBrowser();
    const oauth = oauthDouble(new Subject<unknown>());
    const auth = serviceWith(oauth);
    await auth.bootstrap();

    await auth.tryRefresh();

    expect(oauth['loadDiscoveryDocument']).not.toHaveBeenCalled();
    // Once for the start's own renewal and this one together.
    expect(oauth['setupAutomaticSilentRefresh']).toHaveBeenCalledTimes(1);
  });
});

/**
 * Handing the device back, which recovery is not: sign-out drops the queue outright where recovery
 * weighs subjects first. What it could not drop is marked, so the next start weighs that one too.
 */
describe('signing out', () => {
  let oauth: Record<string, ReturnType<typeof vi.fn>>;
  let outbox: Record<string, ReturnType<typeof vi.fn>>;
  let auth: AuthService;
  let order: string[];

  const recording = (step: string, outcome: () => Promise<unknown>) =>
    vi.fn(() => {
      order.push(step);
      return outcome();
    });

  const dropped = () => Promise.resolve();
  const refused = () => Promise.reject(new Error('storage is not available in this mode'));

  /** Alice's device, signed in and holding her claims. */
  beforeEach(async () => {
    freshBrowser();
    order = [];
    oauth = oauthDouble(new Subject<unknown>());
    oauth['hasValidAccessToken'] = vi.fn(() => true);
    oauth['getIdentityClaims'] = vi.fn(() => ({ sub: 'alice' }));
    outbox = { clear: recording('outbox', dropped) };
    auth = serviceWith(oauth, outbox);
    await auth.bootstrap();
    expect(auth.signedIn()).toBe(true);

    // Stubbed past the bootstrap, so the order records the sign-out alone.
    vi.stubGlobal('caches', { keys: recording('caches', () => Promise.resolve([])) });
    oauth['logOut'] = recording('logOut', dropped);
  });

  it('drops the caches and the queue before the redirect that ends the page', async () => {
    await auth.signOut();

    // The end-session redirect leaves nothing running, so anything not awaited before it never runs.
    expect(order).toEqual(['caches', 'outbox', 'logOut']);
    expect(auth.signedIn()).toBe(false);
  });

  it('settles nothing when the queue went, because there is nothing left to weigh', async () => {
    await auth.signOut();

    expect(localStorage.getItem('todo.recovering-from')).toBeNull();
  });

  it.each([
    ['the caches cannot be dropped', () => vi.stubGlobal('caches', { keys: refused })],
    ['the queue cannot be dropped', () => (outbox['clear'] = vi.fn(refused))],
  ])('ends the session anyway when %s', async (_which, refuse) => {
    refuse();

    await auth.signOut();

    // Guarding the two as a pair would skip this whenever the caches throw, which is the shape
    // that once made the fix fix nothing.
    expect(outbox['clear']).toHaveBeenCalled();
    // Worse than a queue left behind: the next person would get the session itself.
    expect(oauth['logOut']).toHaveBeenCalled();
    expect(auth.signedIn()).toBe(false);
  });

  it('leaves a queue it could not drop for the next start to settle', async () => {
    outbox['clear'] = vi.fn(refused);

    await auth.signOut();

    // Whoever answers the login form is compared against her, rather than flushing her writes.
    expect(localStorage.getItem('todo.recovering-from')).toBe('alice');
  });

  it('ends the session even when the marker cannot be written either', async () => {
    outbox['clear'] = vi.fn(refused);
    markerWriteRefused();

    await auth.signOut();

    expect(oauth['logOut']).toHaveBeenCalled();
    expect(auth.signedIn()).toBe(false);
  });
});
