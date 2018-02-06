import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';

export class LoadDataQueryBuilder implements GraphqlQueryBuilder {
  static create() {
    return new LoadDataQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    return {
      query: `{
        tasklists {
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
      }`
    };
  }
}
