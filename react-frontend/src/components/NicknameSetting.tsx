import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import useNotification from '../hooks/useNotification';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { GET_USER } from '../graphql/quizQueries';
import { SET_NICKNAME } from '../graphql/quizMutations';

interface NicknameSettingProps {
  onNicknameSet?: () => void;
}

const NicknameSetting: React.FC<NicknameSettingProps> = ({ onNicknameSet }) => {
  const { primaryWallet } = useDynamicContext();
  const { queryApplication, onNewBlock, offNewBlock } = useConnection();
  const [user, setUser] = useState<{
    nickname: string;
    walletAddress: string;
    createdAt: string;
  } | null>(null);
  // 使用下划线前缀表示这个变量被使用，避免TypeScript未使用变量警告
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_hasFetchedUser, setHasFetchedUser] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSettingNickname, setIsSettingNickname] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const { success, error } = useNotification();

  // Track query state to prevent concurrent requests
  const isQueryingRef = useRef(false);

  // Check if user has a nickname
  const hasNickname = user?.nickname;

  // Fetch user data when component mounts, wallet address changes, or Linera connection state changes
  const fetchUserData = useCallback(
    async (forceRefresh = false) => {
      if (!primaryWallet?.address) return;

      // 使用函数式状态更新来检查 hasFetchedUser，避免将其作为依赖项
      const shouldFetch = await new Promise(resolve => {
        setHasFetchedUser(currentHasFetched => {
          resolve(forceRefresh || !currentHasFetched);
          return currentHasFetched;
        });
      });

      if (!shouldFetch) {
        return;
      }

      // Prevent concurrent requests
      if (isQueryingRef.current) {
        return;
      }

      const variables = {
        walletAddress: primaryWallet.address.toLowerCase(),
      };

      try {
        isQueryingRef.current = true;
        const result = await queryApplication({
          query: GET_USER,
          variables,
        });
        if (
          result &&
          typeof result === 'object' &&
          'data' in result &&
          result.data &&
          typeof result.data === 'object' &&
          'user' in result.data
        ) {
          const userData = result.data.user as {
            nickname: string;
            walletAddress: string;
            createdAt: string;
          };
          setUser({
            nickname: userData.nickname,
            walletAddress: userData.walletAddress,
            createdAt: userData.createdAt,
          });
          // 设置已查询标志
          setHasFetchedUser(true);
        }
      } catch (err) {
        // Handle error silently
      } finally {
        isQueryingRef.current = false;
      }
    },
    [primaryWallet?.address, queryApplication],
  );

  // 当钱包地址变化时，重置已查询标志
  useEffect(() => {
    if (primaryWallet?.address) {
      setHasFetchedUser(false);
    } else {
      setUser(null);
      setHasFetchedUser(false);
    }
  }, [primaryWallet?.address]);

  // Handle new block event - refresh data
  const handleNewBlock = useCallback(() => {
    fetchUserData(true);
  }, [fetchUserData]);

  // Register new block listener
  useEffect(() => {
    onNewBlock(handleNewBlock);
    return () => {
      offNewBlock(handleNewBlock);
    };
  }, [onNewBlock, offNewBlock, handleNewBlock]);

  // Initial data fetch
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

      // 使用ConnectionContext发送变更请求
      await queryApplication({
        query: SET_NICKNAME,
        variables: {
          field0: {
            nickname: nicknameInput.trim()
          }
        },
      });

      success('昵称设置成功');
      await fetchUserData(true); // 强制刷新用户数据
      setIsEditingNickname(false);
      setNicknameInput('');
      onNicknameSet?.();
    } catch (err) {
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
              onChange={e => setNicknameInput(e.target.value)}
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
              onChange={e => setNicknameInput(e.target.value)}
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
          <p>
            昵称: <span className="nickname">{hasNickname}</span>
          </p>
          <button onClick={toggleEditNickname} className="nickname-edit-btn">
            编辑昵称
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(NicknameSetting);
