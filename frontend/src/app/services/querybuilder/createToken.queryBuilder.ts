import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsBoolean, IsNotEmpty, validateSync } from 'class-validator';

export class CreateTokenQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  private username: string;

  @IsNotEmpty()
  private password: string;

  @IsBoolean()
  private rememberMe = false;

  static create() {
    return new CreateTokenQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `mutation login($username: String!, $password: String!, $rememberMe: Boolean) {
        createToken(username: $username, password: $password, rememberMe: $rememberMe) {
          token
          error
        }
      }`,
      variables: {
        username: this.username,
        password: this.password,
        rememberMe: this.rememberMe
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

  public setRememberMe(rememberMe: boolean) {
    this.rememberMe = rememberMe;
    return this;
  }
}
