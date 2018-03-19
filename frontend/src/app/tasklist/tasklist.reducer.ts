import { ITasklistState } from './tasklist.model';
import { AnyAction } from 'redux';
import { TasklistActionTypes } from './tasklist.actions';
import { TaskActionTypes } from './task.actions';

export function tasklistReducer(state: ITasklistState = {}, action: AnyAction): ITasklistState {
  switch (action.type) {
    case TasklistActionTypes.SwitchTasklist:
      state = {...state, selectedTasklist: action.payload};
      break;
    case TasklistActionTypes.LoadAllDataSuccess:
      state = {selectedTasklist: action.payload.selectedTasklist, tasklists: action.payload.tasklists};
      break;
    case TasklistActionTypes.ReloadTasklistSuccess:
      const newTasklists = state.tasklists.map(tasklist => {
        if (tasklist.name === action.payload.name) {
          return action.payload;
        }
        return tasklist;
      });
      state = {selectedTasklist: action.payload, tasklists: newTasklists};
      break;
    case TaskActionTypes.UpdateTask:
      const {id} = action.payload;
      let {type} = action.payload;

      let subtasks = state.selectedTasklist.tasks[type].map(task => {
        if (task.id === id) {
          return action.payload;
        }

        return task;
      });

      state = {
        ...state,
        selectedTasklist: {
          ...state.selectedTasklist,
          tasks: {
            ...state.selectedTasklist.tasks,
            [type]: subtasks
          }
        }
      };
      break;
    case TaskActionTypes.AddTask:
      type = action.payload.type;
      subtasks = state.selectedTasklist.tasks[type].slice();
      subtasks.splice(subtasks.length, 0, action.payload);

      state = {
        ...state,
        selectedTasklist: {
          ...state.selectedTasklist,
          tasks: {
            ...state.selectedTasklist.tasks,
            [type]: subtasks
          }
        }
      };
      break;
  }
  return state;
}
