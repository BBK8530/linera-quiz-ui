import React, { useEffect, useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter } from '../providers/LineraAdapter';
import { FaSignOutAlt } from 'react-icons/fa';
import useNotification from '../hooks/useNotification';

const UserInfo: React.FC = () => {
  const { user, primaryWallet, handleLogOut } = useDynamicContext();
  const [isLineraConnected, setIsLineraConnected] = useState(false);
  const [isConnectingLinera, setIsConnectingLinera] = useState(false);
  const { success, error, info } = useNotification();


  // 当primaryWallet变化时，自动连接到Linera网络
  useEffect(() => {
    const connectToLinera = async () => {
      if (!primaryWallet || isLineraConnected || isConnectingLinera) return;

      setIsConnectingLinera(true);
      try {
        await lineraAdapter.connect(primaryWallet);
        await lineraAdapter.setApplication();
        setIsLineraConnected(true);
        console.log('✅ Successfully connected to Linera network');
        success('Successfully connected to Linera Conway network');
      } catch (err) {
        console.error('❌ Failed to connect to Linera network:', err);
        setIsLineraConnected(false);
        error('Failed to connect to Linera Conway network');
      } finally {
        setIsConnectingLinera(false);
      }
    };

    if (primaryWallet && user) {
      connectToLinera();
    } else {
      // 当钱包断开连接时，重置Linera连接
      lineraAdapter.reset();
      setIsLineraConnected(false);
    }
  }, [primaryWallet, user, isLineraConnected, isConnectingLinera, success, error]);



  // Handle logout
  const handleLogout = async () => {
    lineraAdapter.reset();
    await handleLogOut();
    info('Logged out successfully');
  };

  return (
    <div className="user-section">
      <div className="user-info">
        <div className="address-container">
          <span className="address-text">{primaryWallet?.address.substring(2, 10)}</span>
        </div>
        <p>Conway: {isLineraConnected ? '✅' : isConnectingLinera ? '🔄' : '❌'}</p>
      </div>
      <button className="logout-icon-button" onClick={handleLogout} title="登出">
        <FaSignOutAlt size={20} />
      </button>
    </div>
  );
};

export default UserInfo;