import { AnyAction } from 'redux';
import { IFilterState } from './filter.model';
import { FilterActionTypes } from './filter.actions';

export function filterReducer(state: IFilterState = {showDone: false, showFuture: false}, action: AnyAction): IFilterState {
  switch (action.type) {
    case FilterActionTypes.ShowDone:
      state = { ...state, showDone: true };
      break;
    case FilterActionTypes.HideDone:
      state = { ...state, showDone: false };
      break;
    case FilterActionTypes.ShowFuture:
      state = { ...state, showFuture: true };
      break;
    case FilterActionTypes.HideFuture:
      state = { ...state, showFuture: false };
      break;
  }
  return state;
}
