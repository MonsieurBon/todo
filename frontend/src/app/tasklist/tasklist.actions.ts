import { Action, AnyAction } from 'redux';
import { ITask, ITasklist } from './tasklist.model';

export enum TasklistActionTypes {
  LoadAllData = '[Tasklist] Load All Data',
  LoadAllDataSuccess = '[Tasklist] Load All Data Success'
}

export const loadAllDataAction = (selectedTasklist?: string): AnyAction => {
  if (selectedTasklist) {
    return { type: TasklistActionTypes.LoadAllData, payload: selectedTasklist };
  } else {
    return { type: TasklistActionTypes.LoadAllData };
  }
};

export const loadAllDataSuccessAction = (selectedTasklist: ITasklist, tasklists: ITasklist[]): AnyAction => ({
  type: TasklistActionTypes.LoadAllDataSuccess,
  payload: {
    selectedTasklist,
    tasklists
  }
});
