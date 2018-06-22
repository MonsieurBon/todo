import { Injectable } from '@angular/core';
import {
  GraphQlAddTask,
  GraphQlAllData, GraphQlCheckToken, GraphQlCreateTasklist, GraphQlEditTask, GraphQlLogin, GraphQlReloadTasklist,
  GraphQlTask
} from './graphql.definition';
import { GraphqlClientFactory } from './graphql-client.factory';
import { LoadDataQueryBuilder } from './querybuilder/loadData.queryBuilder';
import { ReloadTasklistQueryBuilder } from './querybuilder/reloadTasklist.queryBuilder';
import { CreateTokenQueryBuilder } from './querybuilder/createToken.queryBuilder';
import { CheckTokenQueryBuilder } from './querybuilder/checkToken.queryBuilder';
import { ITask } from '../tasklist/tasklist.model';
import { EditTaskQueryBuilder } from './querybuilder/editTask.queryBuilder';
import { AddTaskQueryBuilder } from './querybuilder/addTask.queryBuilder';
import { CreateTasklistQueryBuilder } from './querybuilder/createTasklist.queryBuilder';

@Injectable()
export class GraphqlService {
  constructor(private graphQlClientFactory: GraphqlClientFactory) {}

  loadAllData(showDone: boolean, showFuture: boolean): Promise<GraphQlAllData> {
    const client = this.graphQlClientFactory.getClient();

    const request = LoadDataQueryBuilder.create()
      .setShowDone(showDone)
      .setShowFuture(showFuture)
      .getRequest();

    return client.request<GraphQlAllData>(request.query, request.variables);
  }

  reloadTasklist(slug: string, showDone: boolean, showFuture: boolean): Promise<GraphQlReloadTasklist> {
    const client = this.graphQlClientFactory.getClient();

    const request = ReloadTasklistQueryBuilder.create()
      .setSlug(slug)
      .setShowDone(showDone)
      .setShowFuture(showFuture)
      .getRequest();

    return client.request<GraphQlReloadTasklist>(request.query, request.variables);
  }

  createTasklist(name: string): Promise<GraphQlCreateTasklist> {
    const client = this.graphQlClientFactory.getClient();

    const request = CreateTasklistQueryBuilder.create()
      .setName(name)
      .getRequest();

    return client.request<GraphQlCreateTasklist>(request.query, request.variables);
  }

  editTask(task: ITask, showDone: boolean, showFuture: boolean): Promise<GraphQlEditTask> {
    const client = this.graphQlClientFactory.getClient();

    const request = EditTaskQueryBuilder.create()
      .setId(task.id)
      .setTitle(task.title)
      .setDescription(task.description)
      .setType(task.type)
      .setState(task.state)
      .setStartdate(task.startdate)
      .setDuedate(task.duedate)
      .setShowDone(showDone)
      .setShowFuture(showFuture)
      .getRequest();

    return client.request<GraphQlEditTask>(request.query, request.variables);
  }

  addTask(tasklist_id: number, task: ITask, showDone: boolean, showFuture: boolean): Promise<GraphQlAddTask> {
    const client = this.graphQlClientFactory.getClient();

    const request = AddTaskQueryBuilder.create()
      .setTasklistId(tasklist_id)
      .setTitle(task.title)
      .setDescription(task.description)
      .setType(task.type)
      .setStartdate(task.startdate)
      .setDuedate(task.duedate)
      .setShowDone(showDone)
      .setShowFuture(showFuture)
      .getRequest();

    return client.request<GraphQlAddTask>(request.query, request.variables);
  }

  login(username: string, password: string): Promise<GraphQlLogin> {
    const authClient = this.graphQlClientFactory.getAuthClient();

    const request = CreateTokenQueryBuilder.create()
      .setUsername(username)
      .setPassword(password)
      .getRequest();

    return authClient.request<GraphQlLogin>(request.query, request.variables);
  }

  checkToken(token: string): Promise<GraphQlCheckToken> {
    const authClient = this.graphQlClientFactory.getAuthClient();

    const request = CheckTokenQueryBuilder.create()
      .setToken(token)
      .getRequest();

    return authClient.request<GraphQlCheckToken>(request.query, request.variables);
  }
}
