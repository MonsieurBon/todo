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

export interface GraphQLAllData {
  tasklists: GraphQLTasklist[];
}

interface GraphQLTasklist {
  id: number;
  name: string;
  tasks: ITask[];
}

interface GraphQLTask {
  id: number;
  title: string;
  description: string;
  startdate: string;
  duedate: string;
  state: TaskState;
  type: TaskType;
}
