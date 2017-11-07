import { GraphqlService } from './graphql.service';
import { GraphqlClientFactory } from './graphql-client.factory';
import { GraphQLClient } from 'graphql-request';
import Spy = jasmine.Spy;

describe('GraphqlService', () => {
  let spy: Spy;
  let graphQlService: GraphqlService;

  beforeEach(() => {
    const client = new GraphQLClient('');
    spy = spyOn(client, 'request');

    const factory = {
      getClient: () => client,
      getAuthClient: () => client
    };
    graphQlService = new GraphqlService(factory as GraphqlClientFactory);
  });


  it('should query all data', () => {
    graphQlService.loadAllData();

    expect(spy.calls.count()).toBe(1);
    expect(spy.calls.mostRecent().args[0]).toEqual(GraphqlService.loadDataQuery);
  });

  it('should login', () => {
    const username = 'foo';
    const password = 'bar';

    graphQlService.login(username, password);

    expect(spy.calls.count()).toBe(1);
    expect(spy.calls.mostRecent().args[0]).toEqual(GraphqlService.loginMutation);
    expect(spy.calls.mostRecent().args[1]).toEqual({username: username, password: password});
  });

  it('should check token', () => {
    const token = 'a1b2c3d4';

    graphQlService.checkToken(token);

    expect(spy.calls.count()).toBe(1);
    expect(spy.calls.mostRecent().args[0]).toEqual(GraphqlService.checkTokenQuery);
    expect(spy.calls.mostRecent().args[1]).toEqual({token: token});
  });
});
