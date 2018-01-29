import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { AnyAction } from 'redux';
import { Observable } from 'rxjs/Observable';
import { UPDATE_LOCATION } from '@angular-redux/router';
import { filter, map } from 'rxjs/operators';
import { loadAllDataAction } from '../tasklist/tasklist.actions';
import { Router } from '@angular/router';

@Injectable()
export class RouterEpics {
  constructor(private router: Router) {}

  gotoTasklist = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(UPDATE_LOCATION)
      .pipe(
        filter((action: AnyAction) => action.payload.startsWith('/tasklist')),
        map((action: AnyAction) => {
          const url = this.router.parseUrl(action.payload);
          const segments = url.root.children.primary.segments;

          if (segments.length > 1) {
            return loadAllDataAction(segments[1].path);
          } else {
            return loadAllDataAction();
          }
        })
      );
  }
}
