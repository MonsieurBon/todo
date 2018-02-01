import { IAuthState } from './auth.model';
import { AuthActionTypes } from './auth.actions';
import { AnyAction } from 'redux';

const INITIAL_STATE: IAuthState = {
  pending: false,
  token: null,
  error: null,
  requestedUrl: null
};

export function authReducer(state: IAuthState = INITIAL_STATE, action: AnyAction): IAuthState {
  switch (action.type) {
    case AuthActionTypes.RequestedUrl:
      state = {...state, requestedUrl: action.payload};
      break;
    case AuthActionTypes.Login:
      state = {...state, pending: true};
      break;
    case AuthActionTypes.LoginSuccess:
      state = {...state, pending: false, token: action.payload, error: null};
      break;
    case AuthActionTypes.LoginFailed:
      state = {...state, pending: false, token: null, error: action.payload};
      break;
    case AuthActionTypes.CheckTokenSuccess:
      state = {...state, pending: false, token: action.payload, error: null};
      break;
  }
  return state;
}
