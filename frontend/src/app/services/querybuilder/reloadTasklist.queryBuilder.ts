import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsNotEmpty, validateSync } from 'class-validator';

export class ReloadTasklistQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  private slug: string;
  private showDone = false;
  private showFuture = false;

  static create() {
    return new ReloadTasklistQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `query($slug: String!, $showDone: Boolean, $showFuture: Boolean) {
        tasklist(slug: $slug) {
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
        slug: this.slug,
        showDone: this.showDone,
        showFuture: this.showFuture
      }
    };
  }

  public setSlug(slug: string) {
    this.slug = slug;
    return this;
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
