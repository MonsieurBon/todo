import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoApi } from './todo-api';

describe('the board request', () => {
  let api: TodoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TodoApi);
    http = TestBed.inject(HttpTestingController);
  });

  const query = (filter: Parameters<TodoApi['board']>[0]): string => {
    api.board(filter).subscribe();
    const request = http.expectOne((r) => r.url === '/api/board');
    request.flush({ zones: [], tasks: [] });
    return request.request.params.toString();
  };

  it('asks for deferred tasks only while they are wanted', () => {
    expect(query({ includeDeferred: true })).toBe('includeDeferred=true');
    expect(query({ includeDeferred: false })).toBe('');
    expect(query({})).toBe('');
  });

  // The server's day decides which date that is: the browser's clock runs in some other zone.
  it('defers by a number of days, and leaves the date to the server', () => {
    api.defer(7, 1).subscribe();
    api.deferAll([7, 8], 30).subscribe();

    expect(http.expectOne('/api/tasks/7/defer').request.body).toEqual({ days: 1 });
    expect(http.expectOne('/api/tasks/defer').request.body).toEqual({ taskIds: [7, 8], days: 30 });
  });

  it('brings a task back from its deferral by its own id', () => {
    api.undefer(7).subscribe();

    const request = http.expectOne('/api/tasks/7/undefer');
    expect(request.request.method).toBe('POST');
    request.flush({});
  });
});
