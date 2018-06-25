import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsNotEmpty, validateSync } from 'class-validator';

export class DestroyTokenQueryBuilder implements GraphqlQueryBuilder {

  static create() {
    return new DestroyTokenQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `mutation {
        destroyToken {
          success
        }
      }`
    };
  }
}
