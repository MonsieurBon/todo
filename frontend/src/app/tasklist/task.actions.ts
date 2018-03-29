import { AnyAction } from 'redux';
import { ITask, TaskType } from './tasklist.model';

export enum TaskActionTypes {
  AddTask = '[Task] Add Task',
  UpdateTask = '[Task] Update Task',
  MoveTask = '[Task] Move Task',
}

export const addTaskAction = (task: ITask): AnyAction => ({ type: TaskActionTypes.AddTask, payload: task });

export const updateTaskAction = (task: ITask): AnyAction => ({ type: TaskActionTypes.UpdateTask, payload: task });

export const moveTaskAction = (task: ITask, currentType: TaskType) => ({
  type: TaskActionTypes.MoveTask,
  payload: {
    task,
    currentType
  }
});
