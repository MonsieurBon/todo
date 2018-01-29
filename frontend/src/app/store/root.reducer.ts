import { combineReducers } from 'redux';
import { IAppState } from './root.model';
import { authReducer } from '../auth/auth.reducer';
import { tasklistReducer } from '../tasklist/tasklist.reducer';
import { routerReducer } from '@angular-redux/router';

export const rootReducer = combineReducers<IAppState>({
  auth: authReducer,
  tasklist: tasklistReducer,
  route: routerReducer
});
