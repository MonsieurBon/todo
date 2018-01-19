import { GraphqlClientFactory } from './graphql-client.factory';
import { MockNgRedux } from '@angular-redux/store/lib/testing';
import { Subject } from 'rxjs/Subject';

describe('GraphqlClientFactoryService', () => {
  it('should return the same client initially', () => {
    const ngRedux = MockNgRedux.getInstance();
    const factory = new GraphqlClientFactory(ngRedux);

    const client = factory.getClient();
    const authClient = factory.getAuthClient();

    expect(client).toEqual(authClient);
  });

  it('should return a different client after token is set', () => {
    const tokenStub = new Subject<string>();
    const ngReduxMock = MockNgRedux.getInstance();

    spyOn(ngReduxMock, 'select').and.returnValue(tokenStub);

    const factory = new GraphqlClientFactory(ngReduxMock);

    tokenStub.next('a1b2c3d4');

    const client = factory.getClient();
    const authClient = factory.getAuthClient();

    expect(client).not.toEqual(authClient);

    tokenStub.next('e5f6g7h8');

    const newClient = factory.getClient();

    expect(client).not.toEqual(newClient);

    tokenStub.next('');

    const thirdClient = factory.getClient();
    expect(client).not.toEqual(thirdClient);
    expect(authClient).toEqual(thirdClient);
  });
});
