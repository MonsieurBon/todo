export interface ITasklistState {
  selectedTasklist?: ITasklist;
  tasklists?: ITasklist[];
}

export interface ITasklist {
  id: number;
  name: string;
  slug: string;
  tasks?: ITask[][];
}

export interface ITask {
  id?: number;
  title: string;
  description?: string;
  startdate: Date;
  duedate?: Date;
  state: TaskState;
  type: TaskType;
}

export enum TaskState {
  TODO = 'TODO',
  DONE = 'DONE'
}

export enum TaskType {
  CRITICAL_NOW = 'CRITICAL_NOW',
  OPPORTUNITY_NOW = 'OPPORTUNITY_NOW',
  OVER_THE_HORIZON = 'OVER_THE_HORIZON'
}
