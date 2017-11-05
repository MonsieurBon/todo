import { combineReducers } from 'redux';
import { tasklistReducer } from '../tasklist/tasklist.reducer';
import { routerReducer } from '@angular-redux/router';
import { IAppState } from './root.model';
import { authReducer } from '../auth/auth.reducer';

export const rootReducer = combineReducers<IAppState>({
  auth: authReducer,
  tasklists: tasklistReducer,
  routes: routerReducer
});
