import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';
import { GraphQLClient } from 'graphql-request';
import { GraphQLAllData, GraphQlCheckToken, GraphQlLogin } from './graphql.definition';
import { NgRedux } from '@angular-redux/store';
import { IAppState } from '../store/root.model';
import { IAuthState } from '../auth/auth.model';

@Injectable()
export class GraphqlService implements OnDestroy {
  private client: GraphQLClient;
  private endpoint: string;
  private subscription;

  constructor(private ngRedux: NgRedux<IAppState>) {
    this.endpoint = environment.graphql.endpoint;
    this.client = new GraphQLClient(this.endpoint);

    this.subscription = this.ngRedux.select<IAuthState>('auth')
      .subscribe(newAuthState => {
        if (newAuthState.token) {
          const headers = {
            'X-AUTH-TOKEN': newAuthState.token
          };
          this.client = new GraphQLClient(this.endpoint, { headers: headers });
        } else {
          this.client = new GraphQLClient(this.endpoint);
        }
      });
  }

  loadAllData(): Promise<GraphQLAllData> {
    const query = `{
      tasklists {
        id
        name
      }
    }`;

    return this.client.request<GraphQLAllData>(query);
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

    const loginClient = new GraphQLClient(this.endpoint);

    return loginClient.request<GraphQlLogin>(query, variables);
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

    const loginClient = new GraphQLClient(this.endpoint);

    return loginClient.request<GraphQlCheckToken>(query, variables);
  };

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
