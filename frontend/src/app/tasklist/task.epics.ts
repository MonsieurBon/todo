import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { loginFailedAction } from '../auth/auth.actions';
import { AnyAction } from 'redux';
import { from, Observable, of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { GraphqlService } from '../services/graphql.service';
import { reloadTasklistDataReceivedAction } from './tasklist.actions';
import { TaskActionTypes } from './task.actions';

@Injectable()
export class TaskEpics {
  constructor(
    private graphQl: GraphqlService,
  ) {}

  editTask = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TaskActionTypes.UpdateTask)
      .pipe(
        mergeMap((action: AnyAction) => {
          return from(this.graphQl.editTask(action.payload))
            .pipe(
              map((result) => {
                const task = result.editTask.task;
                const tasklist = result.editTask.task.tasklist;
                if (!tasklist.tasks.some(sometask => sometask.id === task.id)) {
                  tasklist.tasks.unshift(task);
                }
                return reloadTasklistDataReceivedAction(tasklist);
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }

  addTask = (action$: ActionsObservable<AnyAction>, state$): Observable<AnyAction> => {
    return action$.ofType(TaskActionTypes.AddTask)
      .pipe(
        mergeMap((action: AnyAction) => {
          const tasklist_id = state$.value.tasklist.selectedTasklist.id;
          return from(this.graphQl.addTask(tasklist_id, action.payload))
            .pipe(
              map((result) => {
                const task = result.addTask.task;
                const tasklist = result.addTask.task.tasklist;
                if (!tasklist.tasks.some(sometask => sometask.id === task.id)) {
                  tasklist.tasks.unshift(task);
                }
                return reloadTasklistDataReceivedAction(tasklist);
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }

  moveTask = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TaskActionTypes.MoveTask)
      .pipe(
        mergeMap((action: AnyAction) => {
          return from(this.graphQl.editTask(action.payload.task))
            .pipe(
              map((result) => {
                const task = result.editTask.task;
                const tasklist = result.editTask.task.tasklist;
                if (!tasklist.tasks.some(sometask => sometask.id === task.id)) {
                  tasklist.tasks.unshift(task);
                }
                return reloadTasklistDataReceivedAction(tasklist);
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }
}
