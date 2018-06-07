import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { AnyAction } from 'redux';
import { Observable ,  of } from 'rxjs';
import { UPDATE_LOCATION } from '@angular-redux/router';
import { filter, map, mergeMap } from 'rxjs/operators';
import { loadAllDataAction, reloadTasklistAction, switchTasklistAction } from '../tasklist/tasklist.actions';
import { Router } from '@angular/router';

@Injectable()
export class RouterEpics {
  constructor(private router: Router) {}

  gotoTasklist = (action$: ActionsObservable<AnyAction>, state$): Observable<AnyAction> => {
    return action$.ofType(UPDATE_LOCATION)
      .pipe(
        filter((action: AnyAction) => action.payload.startsWith('/tasklist')),
        mergeMap((action: AnyAction) => {
          const url = this.router.parseUrl(action.payload);
          const segments = url.root.children.primary.segments;

          if (segments.length > 1) {
            const tasklistSlug = segments[1].path;
            const tasklists = state$.value.tasklist.tasklists;
            if (tasklists) {
              const newSelectedTasklist = tasklists.find(tasklist => tasklist.slug === tasklistSlug);
              if (newSelectedTasklist) {
                return of(switchTasklistAction(newSelectedTasklist), reloadTasklistAction(newSelectedTasklist.slug));
              }
            }
            return of(loadAllDataAction(tasklistSlug));
          }
          return of(loadAllDataAction());
        })
      );
  }
}
