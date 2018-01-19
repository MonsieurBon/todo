import { IAuthState } from './auth.model';
import { AuthActionTypes } from './auth.actions';
import { AnyAction } from 'redux';

const INITIAL_STATE: IAuthState = {
  token: null,
  error: null
};

export function authReducer(state: IAuthState = INITIAL_STATE, action: AnyAction): IAuthState {
  switch (action.type) {
    case AuthActionTypes.LoginSuccess:
      state = {...state, token: action.payload, error: null};
      break;
    case AuthActionTypes.LoginFailed:
      state = {...state, token: null, error: action.payload};
      break;
  }
  return state;
}
