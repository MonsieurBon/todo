import { TestBed, inject } from '@angular/core/testing';

import { GraphqlActions } from './graphql.actions';

describe('GraphqlActions', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GraphqlActions]
    });
  });

  it('should be created', inject([GraphqlActions], (service: GraphqlActions) => {
    expect(service).toBeTruthy();
  }));
});
