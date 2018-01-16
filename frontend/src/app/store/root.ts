import { combineReducers } from 'redux';
import { IAppState } from './root.model';
import { fooReducer } from './foo.reducer';

export const rootReducer = combineReducers<IAppState>({
  foo: fooReducer
});
