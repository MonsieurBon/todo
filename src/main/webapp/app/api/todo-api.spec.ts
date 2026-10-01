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
});
