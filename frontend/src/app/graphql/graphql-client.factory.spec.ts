import { TestBed, inject } from '@angular/core/testing';

import { GraphqlClientFactory } from './graphql-client.factory';

describe('GraphqlClientFactoryService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GraphqlClientFactory]
    });
  });

  it('should be created', inject([GraphqlClientFactory], (service: GraphqlClientFactory) => {
    expect(service).toBeTruthy();
  }));
});
