import { Injectable } from '@angular/core';
import { GraphQLAllData, GraphQlCheckToken, GraphQlLogin } from './graphql.definition';
import { GraphqlClientFactory } from './graphql-client.factory';

@Injectable()
export class GraphqlService {
  constructor(private graphQlClientFactory: GraphqlClientFactory) {}

  loadAllData(): Promise<GraphQLAllData> {
    const query = `{
      tasklists {
        id
        name
      }
    }`;

    return this.graphQlClientFactory.getClient().request<GraphQLAllData>(query);
  }

  login(username: string, password: string): Promise<GraphQlLogin> {
    const query = `mutation login($username: String!, $password: String!) {
      createToken(username: $username, password: $password) {
        token
        error
      }
    }`;

    const variables = {
      username: username,
      password: password
    };

    return this.graphQlClientFactory.getAuthClient().request<GraphQlLogin>(query, variables);
  }

  checkToken(token: string): Promise<GraphQlCheckToken> {
    const query = `query TokenValidity($token: String!) {
      checkToken(token: $token) {
        token
      }
    }`;

    const variables = {
      token: token
    };

    return this.graphQlClientFactory.getAuthClient().request<GraphQlCheckToken>(query, variables);
  }
}
