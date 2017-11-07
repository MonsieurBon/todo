import { Injectable } from '@angular/core';
import { GraphQLClient } from 'graphql-request';
import { IAppState } from '../store/root.model';
import { NgRedux } from '@angular-redux/store';
import { environment } from '../../environments/environment';

@Injectable()
export class GraphqlClientFactory {
  private client = null;
  private authClient = null;
  private endpoint = environment.graphql.endpoint;
  private subscription;

  constructor(private ngRedux: NgRedux<IAppState>) {
    this.authClient = new GraphQLClient(this.endpoint);
    this.client = null;

    this.subscription = this.ngRedux.select<string>(['auth', 'token'])
      .subscribe(newToken => {
        if (newToken) {
          this.createNewClient(newToken);
        } else {
          this.client = null;
        }
      });
  }

  getClient(): GraphQLClient {
    return this.client !== null ? this.client : this.authClient;
  }

  getAuthClient(): GraphQLClient {
    return this.authClient;
  }

  private createNewClient(token: string) {
    const headers = {
      'X-AUTH-TOKEN': token
    };
    this.client = new GraphQLClient(this.endpoint, { headers: headers });
  }
}
