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
        environmentId: "5d6f2905-e337-4b1b-bd35-308c00f6de7a", // 需要从Dynamic控制台获取
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
};
