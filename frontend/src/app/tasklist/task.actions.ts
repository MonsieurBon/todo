import { AnyAction } from 'redux';
import { ITask } from './tasklist.model';

export enum TaskActionTypes {
  AddTask = '[Task] Add Task',
  UpdateTask = '[Task] Update Task',
}

export const addTaskAction = (task: ITask): AnyAction => ({type: TaskActionTypes.AddTask, payload: task});

export const updateTaskAction = (task: ITask): AnyAction => ({type: TaskActionTypes.UpdateTask, payload: task});
