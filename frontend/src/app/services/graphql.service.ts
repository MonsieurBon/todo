import { Injectable } from '@angular/core';
import { GraphQlAllData, GraphQlCheckToken, GraphQlLogin, GraphQlReloadTasklist } from './graphql.definition';
import { GraphqlClientFactory } from './graphql-client.factory';

@Injectable()
export class GraphqlService {
  static loadDataQuery = `{
    tasklists {
      id
      name
      slug
      tasks {
    	  id
        title
        description
        startdate
        duedate
        state
        type
      }
    }
  }`;

  static reloadTasklistQuery = `query($slug: String!) {
    tasklist(slug: $slug) {
      id
      name
      slug
      tasks {
        id
        title
        description
        startdate
        duedate
        state
        type
      }
    }
  }`;

  static loginMutation = `mutation login($username: String!, $password: String!) {
    createToken(username: $username, password: $password) {
      token
      error
    }
  }`;

  static checkTokenQuery = `query TokenValidity($token: String!) {
    checkToken(token: $token) {
      token
    }
  }`;

  constructor(private graphQlClientFactory: GraphqlClientFactory) {}

  loadAllData(): Promise<GraphQlAllData> {
    const client = this.graphQlClientFactory.getClient();
    return client.request<GraphQlAllData>(GraphqlService.loadDataQuery);
  }

  reloadTasklist(slug: string): Promise<GraphQlReloadTasklist> {
    const variables = {
      slug: slug
    };

    const client = this.graphQlClientFactory.getClient();
    return client.request<GraphQlReloadTasklist>(GraphqlService.reloadTasklistQuery, variables);
  }

  login(username: string, password: string): Promise<GraphQlLogin> {
    const variables = {
      username: username,
      password: password
    };

    const authClient = this.graphQlClientFactory.getAuthClient();

    return authClient.request<GraphQlLogin>(GraphqlService.loginMutation, variables);
  }

  checkToken(token: string): Promise<GraphQlCheckToken> {
    const variables = {
      token: token
    };

    const authClient = this.graphQlClientFactory.getAuthClient();
    return authClient.request<GraphQlCheckToken>(GraphqlService.checkTokenQuery, variables);
  }
}
