import { ITask, ITasklistState, TaskState } from './tasklist.model';
import { AnyAction } from 'redux';
import { TasklistActionTypes } from './tasklist.actions';

export function tasklistReducer(state: ITasklistState = {}, action: AnyAction): ITasklistState {
  switch (action.type) {
    case TasklistActionTypes.LoadAllDataSuccess:
      state = {selectedTasklist: action.payload.selectedTasklist, tasklists: action.payload.tasklists};
      break;
  }
  return state;
}
