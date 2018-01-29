export interface ITasklistState {
  selectedTasklist?: ITasklist;
  tasklists?: ITasklist[];
}

export interface ITasklist {
  id: number;
  name: string;
  tasks?: ITask[][];
}

export interface ITask {
  id: number;
  title: string;
  description?: string;
  startdate: Date;
  duedate?: Date;
  state: TaskState;
  type: TaskType;
}

export enum TaskState {
  Todo = 'TODO',
  Done = 'DONE'
}

export enum TaskType {
  Critical_Now = 'CRITICAL_NOW',
  Opportunity_Now = 'OPPORTUNITY_NOW',
  Over_The_Horizon = 'OVER_THE_HORIZON'
}
