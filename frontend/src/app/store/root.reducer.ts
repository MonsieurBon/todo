import { combineReducers } from 'redux';
import { IAppState } from './root.model';
import { authReducer } from '../auth/auth.reducer';

export const rootReducer = combineReducers<IAppState>({
  auth: authReducer
});
