import { ITask, ITasklistState, TaskState } from './tasklist.model';
import { AnyAction } from 'redux';
import { TasklistActionTypes } from './tasklist.actions';

export function tasklistReducer(state: ITasklistState = {}, action: AnyAction): ITasklistState {
  switch (action.type) {
    case TasklistActionTypes.SwitchTasklist:
      state = {...state, selectedTasklist: action.payload};
      break;
    case TasklistActionTypes.LoadAllDataSuccess:
      state = {selectedTasklist: action.payload.selectedTasklist, tasklists: action.payload.tasklists};
      break;
    case TasklistActionTypes.ReloadTasklistSuccess:
      const newTasklists = state.tasklists.map((tasklist) => {
        if (tasklist.name === action.payload.name) {
          return action.payload;
        }
        return tasklist;
      });
      state = {selectedTasklist: action.payload, tasklists: newTasklists};
      break;
  }
  return state;
}
