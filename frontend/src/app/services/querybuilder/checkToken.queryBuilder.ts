import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsNotEmpty, validateSync } from 'class-validator';

export class CheckTokenQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  private token: string;

  static create() {
    return new CheckTokenQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `query TokenValidity($token: String!) {
        checkToken(token: $token) {
          token
        }
      }`,
      variables: {
        token: this.token
      }
    };
  }

  public setToken(token: string) {
    this.token = token;
    return this;
  }
}
