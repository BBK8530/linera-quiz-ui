import React from 'react';
import LoginButton from './LoginButton';

interface WalletConnectionScreenProps {
  isLoading?: boolean;
  loadingText?: string;
  showError?: boolean;
  errorText?: string;
}

const WalletConnectionScreen: React.FC<WalletConnectionScreenProps> = ({
  isLoading = false,
  loadingText = 'Connecting to Linera network...',
  showError = false,
  errorText = ''
}) => {
  return (
    <div className="wallet-connection-screen">
      <div className="connection-content">
        <h1 className="project-name">Quiz Challenge</h1>
        
        {isLoading ? (
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2 className="loading-text">{loadingText}</h2>
          </div>
        ) : showError ? (
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h2 className="error-title">连接失败</h2>
            <p className="error-text">{errorText}</p>
            <div className="login-button-container">
              <LoginButton />
            </div>
          </div>
        ) : (
          <>
            <p className="connection-instruction">
              Connect your wallet to get started
            </p>
            <div className="login-button-container">
              <LoginButton />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletConnectionScreen;