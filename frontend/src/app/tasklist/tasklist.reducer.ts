import { ITasklistState } from './tasklist.model';
import { AnyAction } from 'redux';
import { TasklistActionTypes } from './tasklist.actions';
import { TaskActionTypes } from './task.actions';
import { AuthActionTypes } from '../auth/auth.actions';

export function tasklistReducer(state: ITasklistState = {}, action: AnyAction): ITasklistState {
  switch (action.type) {
    case TasklistActionTypes.SwitchTasklist:
      state = { ...state, selectedTasklist: action.payload };
      break;
    case TasklistActionTypes.LoadAllDataSuccess:
      state = { selectedTasklist: action.payload.selectedTasklist, tasklists: action.payload.tasklists };
      break;
    case TasklistActionTypes.ReloadTasklistSuccess:
      const newTasklists = state.tasklists.map(tasklist => {
        if (tasklist.name === action.payload.name) {
          return action.payload;
        }
        return tasklist;
      });
      state = { selectedTasklist: action.payload, tasklists: newTasklists };
      break;
    case TasklistActionTypes.CreateTasklistSuccess:
      const newTasklist = action.payload;

      let tasklists = [];
      if (state.tasklists) {
        tasklists = state.tasklists.slice();
      }
      tasklists.splice(tasklists.length, 0, newTasklist);

      state = {
        ...state,
        tasklists: tasklists
      };
      break;
    case TaskActionTypes.UpdateTask:
      const { id } = action.payload;
      let { type } = action.payload;

      let subtasks = state.selectedTasklist.tasks[ type ].map(value => {
        if (value.id === id) {
          return action.payload;
        }

        return value;
      });

      state = {
        ...state,
        selectedTasklist: {
          ...state.selectedTasklist,
          tasks: {
            ...state.selectedTasklist.tasks,
            [ type ]: subtasks
          }
        }
      };
      break;
    case TaskActionTypes.AddTask:
      type = action.payload.type;
      subtasks = [];
      if (state.selectedTasklist.tasks[ type ]) {
        subtasks = state.selectedTasklist.tasks[ type ].slice();
      }
      subtasks.splice(subtasks.length, 0, action.payload);

      state = {
        ...state,
        selectedTasklist: {
          ...state.selectedTasklist,
          tasks: {
            ...state.selectedTasklist.tasks,
            [ type ]: subtasks
          }
        }
      };
      break;
    case TaskActionTypes.MoveTask:
      const { task, currentType } = action.payload;
      const newType = action.payload.task.type;

      const currentTypeSubtasks = state.selectedTasklist.tasks[ currentType ].filter(value => value.id !== task.id);
      let newTypeSubtasks = [ task ];

      if (state.selectedTasklist.tasks[ newType ]) {
        newTypeSubtasks = state.selectedTasklist.tasks[ newType ].slice();
        let i;
        for (i = 0; i < newTypeSubtasks.length; i++) {
          if (newTypeSubtasks[ i ].startdate <= task.startdate) {
            break;
          }
        }
        newTypeSubtasks.splice(i, 0, task);
      }

      state = {
        ...state,
        selectedTasklist: {
          ...state.selectedTasklist,
          tasks: {
            ...state.selectedTasklist.tasks,
            [ currentType ]: currentTypeSubtasks,
            [ newType ]: newTypeSubtasks
          }
        }
      };
      break;
    case AuthActionTypes.LogoutSuccess:
      state = {};
  }
  return state;
}
