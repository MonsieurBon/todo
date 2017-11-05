export interface GraphQlLogin {
  createToken: GraphQlCreateToken;
}

interface GraphQlCreateToken {
  token?: string;
  error?: string;
}

export interface GraphQlCheckToken {
  checkToken: {
    token: string;
  };
}

export interface GraphQLAllData {
  tasklists: GraphQLTasklists[];
}

interface GraphQLTasklists {
  id: number;
  name: string;
}
