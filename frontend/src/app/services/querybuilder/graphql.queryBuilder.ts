export interface GraphqlQueryBuilder {
  getRequest(): GraphqlRequest;
}

export interface GraphqlRequest {
  query: string;
  variables?: object;
}
