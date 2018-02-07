import { Action, AnyAction } from 'redux';
import { ITask, ITasklist } from './tasklist.model';

export enum TasklistActionTypes {
  SwitchTasklist = '[Tasklist] Switch Tasklist',
  LoadAllData = '[Tasklist] Load All Data',
  LoadAllDataSuccess = '[Tasklist] Load All Data Success',
  ReloadTasklist = '[Tasklist] Reload Tasklist',
  ReloadTasklistSuccess = '[Tasklist] Reload Tasklist Success'
}

export const switchTasklistAction = (tasklist: ITasklist): AnyAction => ({type: TasklistActionTypes.SwitchTasklist, payload: tasklist});

export const loadAllDataAction = (tasklist?: string): AnyAction => ({type: TasklistActionTypes.LoadAllData, payload: tasklist});

export const loadAllDataSuccessAction = (selectedTasklist: ITasklist, tasklists: ITasklist[]): AnyAction => ({
  type: TasklistActionTypes.LoadAllDataSuccess,
  payload: {
    selectedTasklist,
    tasklists
  }
});

export const reloadTasklistAction = (tasklistName: string): AnyAction => ({
  type: TasklistActionTypes.ReloadTasklist,
  payload: tasklistName
});

export const reloadTasklistSuccessAction = (tasklist: ITasklist): AnyAction => ({
  type: TasklistActionTypes.ReloadTasklistSuccess,
  payload: tasklist
});
