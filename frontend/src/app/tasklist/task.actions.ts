import { AnyAction } from 'redux';
import { ITask } from './tasklist.model';

export enum TaskActionTypes {
  UpdateTask = '[Task] Update Task',
  UpdateTaskSuccess = '[Task] Update Task Success'
}

export const updateTaskAction = (task: ITask): AnyAction => ({type: TaskActionTypes.UpdateTask, payload: task});

export const updateTaskActionSuccess = (task: ITask): AnyAction => ({type: TaskActionTypes.UpdateTaskSuccess, payload: task});
