import React from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

interface DynamicWalletProviderProps {
  children: React.ReactNode;
}

export const DynamicWalletProvider: React.FC<DynamicWalletProviderProps> = ({ children }) => {
  return (
    <DynamicContextProvider
      theme="auto"
      settings={{
        environmentId: "08f301cc-9979-4291-ae59-468ecd3f4825", // 需要从Dynamic控制台获取
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
};
