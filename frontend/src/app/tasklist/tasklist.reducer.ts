import { GraphqlActions } from '../graphql/graphql.actions';
import { ITasklistState } from './tasklist.model';

export function tasklistReducer(state: ITasklistState = {}, action): ITasklistState {
  switch (action.type) {
    case GraphqlActions.LOAD_MAIN_DATA_FULFILLED:
      const tasklists = action.payload.tasklists;
      const selectedTasklistId = tasklists[0].id;
      state = {...state, tasklists: tasklists, selectedTasklistId: selectedTasklistId};
  }
  return state;
}
