import { Injectable } from '@angular/core';
import { GraphQLAllData, GraphQlCheckToken, GraphQlLogin } from './graphql.definition';
import { GraphqlClientFactory } from './graphql-client.factory';

@Injectable()
export class GraphqlService {
  static loadDataQuery = `{
    tasklists {
      id
      name
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

  loadAllData(): Promise<GraphQLAllData> {
    const client = this.graphQlClientFactory.getClient();
    return client.request<GraphQLAllData>(GraphqlService.loadDataQuery);
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
