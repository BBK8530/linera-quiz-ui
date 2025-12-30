import React, { useMemo } from 'react';
import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

function apolloClient(
  chainId: string,
  applicationId: string,
  port: string,
  host = 'localhost',
) {
  const wsUrl = `ws://${host}:${port}/ws`;
  const httpUrl = `http://${host}:${port}/chains/${chainId}/applications/${applicationId}`;

  const wsLink = new GraphQLWsLink(
    createClient({
      url: wsUrl,
      connectionParams: () => ({
        chainId: chainId,
        applicationId: applicationId,
      }),
      shouldRetry: () => true,
      retryAttempts: 10,
      retryWait: async retries => {
        const delay = Math.min(500 * Math.pow(1.2, retries), 3000);
        await new Promise(resolve => setTimeout(resolve, delay));
      },
      keepAlive: 5000,
      on: {
        connecting: () => {},
        connected: () => {},
        error: error => console.error('GraphQL WebSocket error:', error),
        closed: event => {},
        ping: () => {},
        pong: () => {},
      },
    }),
  );

  const httpLink = new HttpLink({
    uri: httpUrl,
  });

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink,
  );
  return new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
        notifyOnNetworkStatusChange: false,
        fetchPolicy: 'cache-first',
      },
      query: {
        errorPolicy: 'all',
        fetchPolicy: 'cache-first',
      },
      mutate: {
        errorPolicy: 'ignore',
      },
    },
  });
}

function GraphQLProvider({
  chainId,
  applicationId,
  port,
  host = 'localhost',
  children,
}: {
  chainId: string;
  applicationId: string;
  port: string;
  host?: string;
  children: React.ReactElement;
}) {
  const client = useMemo(() => {
    return apolloClient(chainId, applicationId, port, host);
  }, [chainId, applicationId, port, host]);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export default GraphQLProvider;
