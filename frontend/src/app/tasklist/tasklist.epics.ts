import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { loginFailedAction } from '../auth/auth.actions';
import { Action, AnyAction } from 'redux';
import { Observable ,  from ,  of } from 'rxjs';
import { catchError, map, mergeMap, withLatestFrom } from 'rxjs/operators';
import { GraphqlService } from '../services/graphql.service';
import {
  createTasklistSuccess,
  loadAllDataSuccessAction, reloadTasklistDataReceivedAction, reloadTasklistSuccessAction, switchTasklistAction,
  TasklistActionTypes
} from './tasklist.actions';
import groupBy from 'lodash-es/groupBy';
import { ActivatedRoute, Router } from '@angular/router';
import { ITask, ITasklist } from './tasklist.model';
import { Location } from '@angular/common';
import { GraphqlTransformer } from '../services/graphql.transformer';
import { GraphQlCreateTasklist, GraphQlTasklist } from '../services/graphql.definition';
import { IFilterState } from '../filter/filter.model';
import { EMPTY } from 'rxjs/internal/observable/empty';

@Injectable()
export class TasklistEpics {
  constructor(
    private activatedRoute: ActivatedRoute,
    private graphQl: GraphqlService,
    private location: Location,
    private router: Router
  ) {}

  loadAllData = (action$: ActionsObservable<AnyAction>, state$): Observable<AnyAction> => {
    return action$.ofType(TasklistActionTypes.LoadAllData)
      .pipe(
        mergeMap((action: AnyAction) => {
          const {showDone, showFuture} = state$.value.filter;
          return from(this.graphQl.loadAllData(showDone, showFuture))
            .pipe(
              map((result) => {
                const tasklists = result.tasklists.map(tasklist => {
                  const taskmap = this.mapTasksByType(tasklist);
                  return {...tasklist, tasks: taskmap};
                });

                if (tasklists.length === 0) {
                  return loadAllDataSuccessAction(null, []);
                }

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

  reloadTasklist = (action$: ActionsObservable<AnyAction>, state$): Observable<AnyAction> => {
    return action$.ofType(TasklistActionTypes.ReloadTasklist)
      .pipe(
        mergeMap((action: AnyAction) => {
          const {showDone, showFuture} = state$.value.filter;
          return from(this.graphQl.reloadTasklist(action.payload, showDone, showFuture))
            .pipe(
              map(result => reloadTasklistDataReceivedAction(result.tasklist)),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }

  reloadTasklistDataReceived = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TasklistActionTypes.ReloadTasklistDataReceived)
      .pipe(
        map((action: AnyAction) => {
          const taskmap = this.mapTasksByType(action.payload);
          const tasklist = {...action.payload, tasks: taskmap};

          return reloadTasklistSuccessAction(tasklist);
        })
      );
  }

  createTasklist = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TasklistActionTypes.CreateTasklist)
      .pipe(
        mergeMap((action: AnyAction) => {
          return from(this.graphQl.createTasklist(action.payload))
            .pipe(
              map((result: GraphQlCreateTasklist) => {
                const {id, name, slug} = result.createTasklist.tasklist;
                return createTasklistSuccess({id, name, slug});
              }),
              catchError(error => of(loginFailedAction(error)))
            );
        })
      );
  }

  navigateToCreatedTasklist = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(TasklistActionTypes.CreateTasklistSuccess)
      .pipe(
        mergeMap((action: AnyAction) => {
          this.router.navigate(['/tasklist/' + action.payload.slug]);
          return EMPTY;
        })
      );
  }

  private mapTasksByType(tasklist: GraphQlTasklist): ITask[][] {
    if (!tasklist.tasks || tasklist.tasks.length === 0) {
      return [];
    }
    const tasks = tasklist.tasks.map(task => {
      return GraphqlTransformer.mapTask(task);
    });
    const taskmap = groupBy(tasks, 'type');
    return taskmap;
  }
}
