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

export interface GraphQlDestroyToken {
  destroyToken: {
    success: boolean;
  };
}

export interface GraphQlAllData {
  tasklists: GraphQlTasklist[];
}

export interface GraphQlReloadTasklist {
  tasklist: GraphQlTasklist;
}

export interface GraphQlCreateTasklist {
  createTasklist: {
    tasklist: GraphQlTasklist;
  };
}

export interface GraphQlEditTask {
  editTask: {
    task: GraphQlTask;
  };
}

export interface GraphQlAddTask {
  addTask: {
    task: GraphQlTask;
  };
}

export interface GraphQlTasklist {
  id: number;
  name: string;
  slug: string;
  tasks: GraphQlTask[];
}

export interface GraphQlTask {
  id: number;
  title: string;
  description: string;
  startdate: string;
  duedate: string;
  state: TaskState;
  type: TaskType;
  tasklist?: GraphQlTasklist;
}
