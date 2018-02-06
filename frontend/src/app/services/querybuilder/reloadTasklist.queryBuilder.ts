import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsNotEmpty, validateSync } from 'class-validator';

export class ReloadTasklistQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  private slug: string;

  static create() {
    return new ReloadTasklistQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `query($slug: String!) {
        tasklist(slug: $slug) {
          id
          name
          slug
          tasks {
            id
            title
            description
            startdate
            duedate
            state
            type
          }
        }
      }`,
      variables: {
        slug: this.slug
      }
    };
  }


  public setSlug(value: string) {
    this.slug = value;
    return this;
  }
}
