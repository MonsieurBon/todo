import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { Action, AnyAction } from 'redux';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FilterActionTypes } from './filter.actions';
import { loadAllDataAction } from '../tasklist/tasklist.actions';

@Injectable()
export class FilterEpics {
  constructor() {
  }

  updateData = (action$: ActionsObservable<AnyAction>, state$): Observable<AnyAction> => {
    return action$.ofType(FilterActionTypes.ShowDone,
      FilterActionTypes.HideDone,
      FilterActionTypes.ShowFuture,
      FilterActionTypes.HideFuture)
      .pipe(
        map((action: Action) => loadAllDataAction(state$.value.tasklist.selectedTasklist.slug))
      );
  }
}
