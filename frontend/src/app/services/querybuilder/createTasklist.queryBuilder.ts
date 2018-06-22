import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsNotEmpty, validateSync } from 'class-validator';
import { TaskType } from '../../tasklist/tasklist.model';

export class CreateTasklistQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  private name: string;

  static create() {
    return new CreateTasklistQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `mutation($name: String!) {
                createTasklist {
                  tasklist(name: $name) {
                    id
                    name
                    slug
                  }
                }
              }`,
      variables: {
        name: this.name
      }
    };
  }

  public setName(name: string) {
    this.name = name;
    return this;
  }
}
