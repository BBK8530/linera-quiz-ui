import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

const httpLink = createHttpLink({
  uri: `http://128.140.73.28:8080/chains/c849b2e88a699cbc8a0e69d0bb81c9d9dce9440cd74b0ece0ff386989e742621/applications/f40c833211c21da76f79bdaa9d86e2807b9c3e86aac3aef80a3541366e6dcdc3`, // 根据实际情况调整GraphQL服务器地址
});

export const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
