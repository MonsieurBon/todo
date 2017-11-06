import { IAuthState } from './auth.model';
import { GraphqlActions } from '../graphql/graphql.actions';

const INITIAL_STATE: IAuthState = {
  token: null,
  tokenChecked: false,
  error: null
};

export function authReducer(state: IAuthState = INITIAL_STATE, action): IAuthState {
  let token = null;
  let error = null;

  switch (action.type) {
    case GraphqlActions.LOGIN_PENDING:
      state = {...state, tokenChecked: false};
      break;
    case GraphqlActions.LOGIN_FULFILLED:
      const loginResult = action.payload.createToken;

      token = loginResult.error ? null : loginResult.token;
      error = loginResult.error ? loginResult.error : null;

      state = {...state, token: token, tokenChecked: false, error: error};
      break;
    case GraphqlActions.LOGIN_REJECTED:
      token = null;
      error = 'Login failed. Check your network connection.';

      state = {...state, token: token, tokenChecked: false, error: error};
      break;
    case GraphqlActions.CHECK_TOKEN_FULFILLED:
      const checkTokenResult = action.payload.checkToken;

      token = checkTokenResult.token;
      error = null;

      state = {...state, token: token, tokenChecked: true, error: error};
      break;
    case GraphqlActions.CHECK_TOKEN_REJECTED:
      token = null;
      error = null;

      state = {...state, token: token, tokenChecked: true, error: error};
  }
  return state;
}
