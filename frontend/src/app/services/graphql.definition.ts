import { ITask, TaskState, TaskType } from '../tasklist/tasklist.model';

export interface GraphQlLogin {
  createToken: GraphQlCreateToken;
}

interface GraphQlCreateToken {
  token?: string;
  error?: string;
}

export interface GraphQlCheckToken {
  checkToken: {
    token: string;
  };
}

export interface GraphQlAllData {
  tasklists: GraphQlTasklist[];
}

export interface GraphQlReloadTasklist {
  tasklist: GraphQlTasklist;
}

interface GraphQlTasklist {
  id: number;
  name: string;
  slug: string;
  tasks: ITask[];
}

interface GraphQlTask {
  id: number;
  title: string;
  description: string;
  startdate: string;
  duedate: string;
  state: TaskState;
  type: TaskType;
}
