import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { loginFailedAction } from '../auth/auth.actions';
import { Action, AnyAction } from 'redux';
import { Observable } from 'rxjs/Observable';
import { catchError, map, mergeMap, withLatestFrom } from 'rxjs/operators';
import { GraphqlService } from '../services/graphql.service';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { of } from 'rxjs/observable/of';
import { loadAllDataSuccessAction, reloadTasklistSuccessAction, TasklistActionTypes } from './tasklist.actions';
import groupBy from 'lodash-es/groupBy';
import { ActivatedRoute, Router } from '@angular/router';
import { ITask, ITasklist } from './tasklist.model';
import { Location } from '@angular/common';
import { TaskActionTypes, updateTaskActionSuccess } from './task.actions';
import { GraphqlTransformer } from '../services/graphql.transformer';

@Injectable()
export class TaskEpics {
  constructor(
    private graphQl: GraphqlService,
  ) {}

  switchTaskState = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TaskActionTypes.UpdateTask)
      .pipe(
        mergeMap((action: AnyAction) => {
          return fromPromise(this.graphQl.editTask(action.payload))
            .pipe(
              map((result) => {
                const task = GraphqlTransformer.mapTask(result.editTask.task);
                return updateTaskActionSuccess(task);
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }
}
