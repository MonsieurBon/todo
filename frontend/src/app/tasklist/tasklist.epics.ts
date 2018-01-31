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

@Injectable()
export class TasklistEpics {
  constructor(
    private activatedRoute: ActivatedRoute,
    private graphQl: GraphqlService,
    private location: Location,
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
                  const taskmap = this.mapTasksByType(tasklist);
                  return {...tasklist, tasks: taskmap};
                });

                let selectedTasklist;
                if (action.payload) {
                  selectedTasklist = tasklists.find(tasklist => tasklist.slug === action.payload);
                }

                if (!selectedTasklist) {
                  selectedTasklist = tasklists[0];
                }

                this.location.go('/tasklist/' + selectedTasklist.slug);
                return loadAllDataSuccessAction(selectedTasklist, tasklists);
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }

  reloadTasklist = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TasklistActionTypes.ReloadTasklist)
      .pipe(
        mergeMap((action: AnyAction) => {
          return fromPromise(this.graphQl.reloadTasklist(action.payload))
            .pipe(
              map((result) => {
                const taskmap = this.mapTasksByType(result.tasklist);
                const tasklist = {...result.tasklist, tasks: taskmap};

                return reloadTasklistSuccessAction(tasklist);
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }

  private mapTasksByType(tasklist): ITask[][] {
    if (!tasklist.tasks || tasklist.tasks.length === 0) {
      return [];
    }
    const tasks = tasklist.tasks.map(task => {
      const startdate = new Date(task.startdate);
      const duedate = task.duedate ? new Date(task.duedate) : null;
      return { ...task, startdate, duedate };
    });
    const taskmap = groupBy(tasks, 'type');
    return taskmap;
  }
}
