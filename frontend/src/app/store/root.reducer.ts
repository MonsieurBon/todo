import { combineReducers } from 'redux';
import { IAppState } from './root.model';
import { authReducer } from '../auth/auth.reducer';
import { tasklistReducer } from '../tasklist/tasklist.reducer';
import { routerReducer } from '@angular-redux/router';
import { filterReducer } from '../filter/filter.reducer';

export const rootReducer = combineReducers<IAppState>({
  auth: authReducer,
  tasklist: tasklistReducer,
  filter: filterReducer,
  route: routerReducer
});
