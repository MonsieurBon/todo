import { Action, AnyAction } from 'redux';
import { ITask, ITasklist } from './tasklist.model';
import { GraphQlTasklist } from '../services/graphql.definition';

export enum TasklistActionTypes {
  CreateTasklist = '[Tasklist] Create Tasklist',
  CreateTasklistSuccess = '[Tasklist] Create Tasklist Success',
  LoadAllData = '[Tasklist] Load All Data',
  LoadAllDataSuccess = '[Tasklist] Load All Data Success',
  ReloadTasklist = '[Tasklist] Reload Tasklist',
  ReloadTasklistDataReceived = '[Tasklist] Reload Tasklist Data Received',
  ReloadTasklistSuccess = '[Tasklist] Reload Tasklist Success',
  SwitchTasklist = '[Tasklist] Switch Tasklist'
}

export const createTasklist = (name: string): AnyAction => ({type: TasklistActionTypes.CreateTasklist, payload: name});

export const createTasklistSuccess = (tasklist: ITasklist): AnyAction => ({
  type: TasklistActionTypes.CreateTasklistSuccess,
  payload: tasklist
});

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

export const reloadTasklistDataReceivedAction = (tasklist: GraphQlTasklist): AnyAction => ({
  type: TasklistActionTypes.ReloadTasklistDataReceived,
  payload: tasklist
});

export const reloadTasklistSuccessAction = (tasklist: ITasklist): AnyAction => ({
  type: TasklistActionTypes.ReloadTasklistSuccess,
  payload: tasklist
});

export const switchTasklistAction = (tasklist: ITasklist): AnyAction => ({type: TasklistActionTypes.SwitchTasklist, payload: tasklist});
