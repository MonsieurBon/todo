import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { loginFailedAction } from '../auth/auth.actions';
import { Action, AnyAction } from 'redux';
import { Observable } from 'rxjs/Observable';
import { catchError, map, mergeMap, withLatestFrom } from 'rxjs/operators';
import { GraphqlService } from '../services/graphql.service';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { of } from 'rxjs/observable/of';
import {
  loadAllDataSuccessAction, reloadTasklistDataReceivedAction, reloadTasklistSuccessAction,
  TasklistActionTypes
} from './tasklist.actions';
import groupBy from 'lodash-es/groupBy';
import { ActivatedRoute, Router } from '@angular/router';
import { ITask, ITasklist } from './tasklist.model';
import { Location } from '@angular/common';
import { TaskActionTypes } from './task.actions';
import { GraphqlTransformer } from '../services/graphql.transformer';

@Injectable()
export class TaskEpics {
  constructor(
    private graphQl: GraphqlService,
  ) {}

  editTask = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TaskActionTypes.UpdateTask)
      .pipe(
        mergeMap((action: AnyAction) => {
          return fromPromise(this.graphQl.editTask(action.payload))
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

  addTask = (action$: ActionsObservable<AnyAction>, store): Observable<AnyAction> => {
    return action$.ofType(TaskActionTypes.AddTask)
      .pipe(
        mergeMap((action: AnyAction) => {
          const tasklist_id = store.getState().tasklist.selectedTasklist.id;
          return fromPromise(this.graphQl.addTask(tasklist_id, action.payload))
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
}
