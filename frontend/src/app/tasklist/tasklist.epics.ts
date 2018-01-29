import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { loginFailedAction } from '../auth/auth.actions';
import { Action, AnyAction } from 'redux';
import { Observable } from 'rxjs/Observable';
import { catchError, map, mergeMap, withLatestFrom } from 'rxjs/operators';
import { GraphqlService } from '../services/graphql.service';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { of } from 'rxjs/observable/of';
import { loadAllDataSuccessAction, TasklistActionTypes } from './tasklist.actions';
import groupBy from 'lodash-es/groupBy';
import { Router } from '@angular/router';

@Injectable()
export class TasklistEpics {
  constructor(
    private graphQl: GraphqlService,
    private router: Router
  ) {}

  loadAllData = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TasklistActionTypes.LoadAllData)
      .pipe(
        mergeMap((action: AnyAction) => {
          return fromPromise(this.graphQl.loadAllData())
            .pipe(
              map((result) => {
                const tasklists = result.tasklists.map(tasklist => {
                  const tasks = tasklist.tasks.map(task => {
                    const startdate = new Date(task.startdate);
                    const duedate = task.duedate ? new Date(task.duedate) : null;
                    return {...task, startdate, duedate};
                  });
                  const taskmap = groupBy(tasks, 'type');
                  return {...tasklist, tasks: taskmap};
                });

                let selectedTasklist;
                if (action.payload) {
                  selectedTasklist = tasklists.find(tasklist => tasklist.slug === action.payload);
                } else {
                  selectedTasklist = tasklists[0];
                }
                return loadAllDataSuccessAction(selectedTasklist, tasklists);
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }
}
