import { Injectable } from '@angular/core';
import {
  GraphQlAllData, GraphQlCheckToken, GraphQlLogin, GraphQlReloadTasklist,
  GraphQlTask
} from './graphql.definition';
import { GraphqlClientFactory } from './graphql-client.factory';
import { LoadDataQueryBuilder } from './querybuilder/loadData.queryBuilder';
import { ReloadTasklistQueryBuilder } from './querybuilder/reloadTasklist.queryBuilder';
import { CreateTokenQueryBuilder } from './querybuilder/createToken.queryBuilder';
import { CheckTokenQueryBuilder } from './querybuilder/checkToken.queryBuilder';
import { ITask } from '../tasklist/tasklist.model';
import { EditTaskQueryBuilder } from './querybuilder/editTask.queryBuilder';

@Injectable()
export class GraphqlService {
  constructor(private graphQlClientFactory: GraphqlClientFactory) {}

  loadAllData(): Promise<GraphQlAllData> {
    const client = this.graphQlClientFactory.getClient();
    const request = LoadDataQueryBuilder.create().getRequest();
    return client.request<GraphQlAllData>(request.query);
  }

  reloadTasklist(slug: string): Promise<GraphQlReloadTasklist> {
    const client = this.graphQlClientFactory.getClient();

    const request = ReloadTasklistQueryBuilder.create()
      .setSlug(slug)
      .getRequest();

    return client.request<GraphQlReloadTasklist>(request.query, request.variables);
  }

  editTask(task: ITask): Promise<GraphQlTask> {
    const client = this.graphQlClientFactory.getClient();

    const request = EditTaskQueryBuilder.create()
      .setId(task.id)
      .setTitle(task.title)
      .setDescription(task.description)
      .setType(task.type)
      .setState(task.state)
      .setStartdate(task.startdate)
      .setDuedate(task.duedate)
      .getRequest();

    return client.request<GraphQlTask>(request.query, request.variables);
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
