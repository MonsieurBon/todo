import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsNotEmpty, validateSync } from 'class-validator';

export class CreateTokenQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  private username: string;

  @IsNotEmpty()
  private password: string;

  static create() {
    return new CreateTokenQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `mutation login($username: String!, $password: String!) {
        createToken(username: $username, password: $password) {
          token
          error
        }
      }`,
      variables: {
        username: this.username,
        password: this.password
      }
    };
  }

  public setUsername(username: string) {
    this.username = username;
    return this;
  }

  public setPassword(password: string) {
    this.password = password;
    return this;
  }
}
