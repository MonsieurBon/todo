import { combineReducers } from 'redux';
import { IAppState } from './root.model';
import { routerReducer } from '@angular-redux/router';

export const rootReducer = combineReducers<IAppState>({
  routes: routerReducer
});
