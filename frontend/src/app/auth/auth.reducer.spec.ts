import { authReducer } from './auth.reducer';
import { GraphqlActions } from '../graphql/graphql.actions';

const emptyState = {token: null, tokenChecked: false, error: null};

describe('Auth reducer tests', () => {
  it('should create initial state', () => {
    const initialState = authReducer(undefined, { type: 'FOO' });
    expect(initialState).toEqual(emptyState);
  });

  it('should only handle auth actions', () => {
    const newState = authReducer(emptyState, { type: 'FOO' });
    expect(newState === emptyState).toBe(true);
  });

  it('should handle LOGIN_PENDING', () => {
    const action = {
      type: GraphqlActions.LOGIN_PENDING
    };
    const inputState = {...emptyState, tokenChecked: true};
    const expectedState = {
      token: null,
      tokenChecked: false,
      error: null
    };

    let newState = authReducer(emptyState, action);
    expect(newState).toEqual(expectedState);

    newState = authReducer(inputState, action);
    expect(newState).toEqual(expectedState);
  });

  it('should handle LOGIN_FULFILLED', () => {
    const successfullLogin = {
      type: GraphqlActions.LOGIN_FULFILLED,
      payload: {
        createToken: {
          token: 'a1b2c3d4'
        }
      }
    };

    const inputState = {
      token: 'e5f6g7h8',
      error: 'something went wrong',
      tokenChecked: false
    };
    let expectedState = {...emptyState, token: 'a1b2c3d4'};
    let newState = authReducer(inputState, successfullLogin);
    expect(newState).toEqual(expectedState);

    const failedLogin = {
      type: GraphqlActions.LOGIN_FULFILLED,
      payload: {
        createToken: {
          error: 'login failed'
        }
      }
    };

    expectedState = {...emptyState, error: 'login failed'};
    newState = authReducer(inputState, failedLogin);
    expect(newState).toEqual(expectedState);
  });

  it('should handle LOGIN_REJECTED', () => {
    const action = {
      type: GraphqlActions.LOGIN_REJECTED
    };

    const inputState = {
      token: 'e5f6g7h8',
      tokenChecked: true,
      error: 'some weird error'
    };

    const expectedState = {
      token: null,
      tokenChecked: false,
      error: 'Login failed. Check your network connection.'
    };

    const newState = authReducer(inputState, action);
    expect(newState).toEqual(expectedState);
  });

  it('should handle CHECK_TOKEN_FULFILLED', () => {
    const action = {
      type: GraphqlActions.CHECK_TOKEN_FULFILLED,
      payload: {
        checkToken: {
          token: 'a1b2c3d4'
        }
      }
    };

    const inputState = {
      token: 'e5f6g7h8',
      tokenChecked: false,
      error: 'some weird error'
    };

    const expectedState = {token: 'a1b2c3d4', tokenChecked: true, error: null};

    const newState = authReducer(inputState, action);
    expect(newState).toEqual(expectedState);
  });

  it('should handle CHECK_TOKEN_REJECTED', () => {
    const action = {
      type: GraphqlActions.CHECK_TOKEN_REJECTED
    };

    const inputState = {
      token: 'e5f6g7h8',
      tokenChecked: false,
      error: 'some weird error'
    };

    const expectedState = {token: null, tokenChecked: true, error: null};

    const newState = authReducer(inputState, action);
    expect(newState).toEqual(expectedState);
  });
});
