import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BoardView, CaptureTask, CreateTask, Task, TaskList, Zone } from './model';

/** The board's filters, as the API takes them. */
export interface BoardFilter {
  list?: number | null;
  label?: string | null;
  zone?: Zone | null;
  includeDone?: boolean;
}

function params(filter: BoardFilter): HttpParams {
  let query = new HttpParams();
  if (filter.list != null) {
    query = query.set('list', filter.list);
  }
  if (filter.label) {
    query = query.set('label', filter.label);
  }
  if (filter.zone) {
    query = query.set('zone', filter.zone);
  }
  if (filter.includeDone) {
    query = query.set('includeDone', true);
  }
  return query;
}

/** One place that knows the URLs. Every type here comes from the API's own contract. */
@Injectable({ providedIn: 'root' })
export class TodoApi {
  private readonly http = inject(HttpClient);

  board(filter: BoardFilter = {}): Observable<BoardView> {
    return this.http.get<BoardView>('/api/board', { params: params(filter) });
  }

  reviewQueue(filter: BoardFilter = {}): Observable<Task[]> {
    return this.http.get<Task[]>('/api/review', { params: params(filter) });
  }

  labels(): Observable<string[]> {
    return this.http.get<string[]>('/api/labels');
  }

  lists(): Observable<TaskList[]> {
    return this.http.get<TaskList[]>('/api/tasklists');
  }

  createList(name: string): Observable<TaskList> {
    return this.http.post<TaskList>('/api/tasklists', { name });
  }

  renameList(id: number, name: string): Observable<TaskList> {
    return this.http.patch<TaskList>(`/api/tasklists/${id}`, { name });
  }

  deleteList(id: number): Observable<void> {
    return this.http.delete<void>(`/api/tasklists/${id}`);
  }

  shareList(id: number, email: string): Observable<TaskList> {
    return this.http.post<TaskList>(`/api/tasklists/${id}/shares`, { email });
  }

  unshareList(id: number, email: string): Observable<TaskList> {
    return this.http.delete<TaskList>(`/api/tasklists/${id}/shares`, { body: { email } });
  }

  capture(task: CaptureTask): Observable<Task> {
    return this.http.post<Task>('/api/tasks/capture', task);
  }

  addToList(listId: number, task: CreateTask): Observable<Task> {
    return this.http.post<Task>(`/api/tasklists/${listId}/tasks`, task);
  }

  complete(id: number): Observable<Task> {
    return this.http.post<Task>(`/api/tasks/${id}/complete`, {});
  }

  reopen(id: number): Observable<Task> {
    return this.http.post<Task>(`/api/tasks/${id}/reopen`, {});
  }

  moveZone(id: number, zone: Zone): Observable<Task> {
    return this.http.post<Task>(`/api/tasks/${id}/zone`, { zone });
  }

  defer(id: number, until: string): Observable<Task> {
    return this.http.post<Task>(`/api/tasks/${id}/defer`, { until });
  }

  markReviewed(id: number): Observable<Task> {
    return this.http.post<Task>(`/api/tasks/${id}/reviewed`, {});
  }

  update(
    id: number,
    patch: { title?: string; notes?: string; dueDate?: string },
  ): Observable<Task> {
    return this.http.patch<Task>(`/api/tasks/${id}`, patch);
  }

  setLabels(id: number, labels: string[]): Observable<Task> {
    return this.http.put<Task>(`/api/tasks/${id}/labels`, { labels });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/tasks/${id}`);
  }
}
