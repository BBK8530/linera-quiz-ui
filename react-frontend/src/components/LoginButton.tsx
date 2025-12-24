import React from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

const LoginButton: React.FC = () => {
  const { setShowAuthFlow, showAuthFlow } = useDynamicContext();

  if (showAuthFlow) {
    return <button className="login-button">Loading...</button>;
  }

  return (
    <button className="login-button" onClick={() => setShowAuthFlow(true)}>
      连接钱包
    </button>
  );
};

export default LoginButton;
