import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

/**
 * The half of recovery the outbox depends on: a queued write it keeps after a 403 only ever
 * leaves the queue if the token is renewed.
 */
describe('the auth interceptor', () => {
  let auth: { accessToken: ReturnType<typeof vi.fn>; tryRefresh: ReturnType<typeof vi.fn> };
  let http: HttpClient;
  let server: HttpTestingController;

  beforeEach(() => {
    auth = { accessToken: vi.fn(() => 'stale'), tryRefresh: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    server = TestBed.inject(HttpTestingController);
  });

  it.each([
    [401, 'expired'],
    [403, 'refused for this surface'],
  ])('renews a %i token (%s) and repeats the request with the new one', async (status) => {
    auth.tryRefresh.mockImplementation(() => {
      auth.accessToken.mockReturnValue('renewed');
      return Promise.resolve(true);
    });
    const response = firstValueFrom(http.get('/api/board'));

    server.expectOne('/api/board').flush(null, { status, statusText: 'Refused' });
    const retry = await vi.waitFor(() => server.expectOne('/api/board'));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer renewed');
    retry.flush({ tasks: [] });

    await expect(response).resolves.toEqual({ tasks: [] });
  });

  it('gives up with the original refusal when the token cannot be renewed', async () => {
    auth.tryRefresh.mockResolvedValue(false);
    const response = firstValueFrom(http.get('/api/board'));

    server.expectOne('/api/board').flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(response).rejects.toMatchObject({ status: 403 });
    server.verify();
  });

  it('leaves any other refusal alone, so the outbox can still drop what is settled', async () => {
    const response = firstValueFrom(http.post('/api/tasks/42/complete', null));

    server
      .expectOne('/api/tasks/42/complete')
      .flush(null, { status: 404, statusText: 'Not Found' });

    await expect(response).rejects.toMatchObject({ status: 404 });
    expect(auth.tryRefresh).not.toHaveBeenCalled();
  });
});
