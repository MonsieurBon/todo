import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';

export class LoadDataQueryBuilder implements GraphqlQueryBuilder {
  private showDone = false;
  private showFuture = false;

  static create() {
    return new LoadDataQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    return {
      query: `query($showDone: Boolean, $showFuture: Boolean) {
        tasklists {
          id
          name
          slug
          tasks(showDone: $showDone, showFuture: $showFuture) {
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
        showDone: this.showDone,
        showFuture: this.showFuture
      }
    };
  }

  public setShowDone(showDone: boolean) {
    this.showDone = showDone;
    return this;
  }

  public setShowFuture(showFuture: boolean) {
    this.showFuture = showFuture;
    return this;
  }
}
