import React, { useState, useEffect, useCallback } from 'react';
import { lineraAdapter } from '../providers/LineraAdapter';
import useNotification from '../hooks/useNotification';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

interface NicknameSettingProps {
  onNicknameSet?: () => void;
}

const NicknameSetting: React.FC<NicknameSettingProps> = ({ onNicknameSet }) => {
  const { primaryWallet } = useDynamicContext();
  const [user, setUser] = useState<{ nickname: string; walletAddress: string; createdAt: string } | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSettingNickname, setIsSettingNickname] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const { success, error } = useNotification();

  // Check if user has a nickname
  const hasNickname = user?.nickname;

  // Fetch user data when component mounts or wallet address changes
  const fetchUserData = useCallback(async () => {
    if (!primaryWallet?.address) return;
    
    try {
      const result = await lineraAdapter.queryApplication<{ data: { user: { nickname: string; walletAddress: string; createdAt: string } } }>({
        query: `query { user(walletAddress: "${primaryWallet.address}") { nickname walletAddress createdAt } }`
      });
      setUser({
        nickname: result.data.user.nickname,
        walletAddress: result.data.user.walletAddress,
        createdAt: result.data.user.createdAt
      });
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  }, [primaryWallet?.address]);

  useEffect(() => {
    if (primaryWallet?.address) {
      fetchUserData();
    }
  }, [primaryWallet?.address, fetchUserData]);

  // Handle nickname submission
  const handleSetNickname = async () => {
    if (!nicknameInput.trim()) {
      error('昵称不能为空');
      return;
    }

    try {
      setIsSettingNickname(true);
      
      // 使用lineraAdapter发送变更请求
      await lineraAdapter.queryApplication({
        query: `mutation { setNickname(field0: { nickname: "${nicknameInput.trim()}" }) }`
      });
      
      success('昵称设置成功');
      await fetchUserData(); // 重新获取用户数据
      setIsEditingNickname(false);
      setNicknameInput('');
      onNicknameSet?.();
    } catch (err) {
      console.error('Failed to set nickname:', err);
      error('昵称设置失败，请稍后重试');
    } finally {
      setIsSettingNickname(false);
    }
  };

  // Toggle nickname edit mode
  const toggleEditNickname = () => {
    if (hasNickname) {
      setNicknameInput(hasNickname);
    }
    setIsEditingNickname(!isEditingNickname);
  };

  return (
    <div className="nickname-container">
      {!hasNickname ? (
        <div className="nickname-setup">
          <h3>设置昵称</h3>
          <div className="nickname-input-group">
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="请输入您的昵称"
              className="nickname-input"
              disabled={isSettingNickname}
            />
            <button
              onClick={handleSetNickname}
              disabled={isSettingNickname || !nicknameInput.trim()}
              className="nickname-submit-btn"
            >
              {isSettingNickname ? '设置中...' : '设置昵称'}
            </button>
          </div>
        </div>
      ) : isEditingNickname ? (
        <div className="nickname-edit">
          <div className="nickname-input-group">
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              className="nickname-input"
              disabled={isSettingNickname}
            />
            <button
              onClick={handleSetNickname}
              disabled={isSettingNickname || !nicknameInput.trim()}
              className="nickname-submit-btn"
            >
              {isSettingNickname ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => setIsEditingNickname(false)}
              disabled={isSettingNickname}
              className="nickname-cancel-btn"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="nickname-display">
          <p>昵称: <span className="nickname">{hasNickname}</span></p>
          <button onClick={toggleEditNickname} className="nickname-edit-btn">
            编辑昵称
          </button>
        </div>
      )}
    </div>
  );
};

export default NicknameSetting;