import { AnyAction } from 'redux';
import { IFilterState } from './filter.model';
import { FilterActionTypes } from './filter.actions';
import { AuthActionTypes } from '../auth/auth.actions';
import { IAuthState } from '../auth/auth.model';

const INITIAL_STATE: IFilterState = {
  showDone: false,
  showFuture: false
};

export function filterReducer(state: IFilterState = INITIAL_STATE, action: AnyAction): IFilterState {
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
    case AuthActionTypes.LogoutSuccess:
      state = INITIAL_STATE;
  }
  return state;
}
