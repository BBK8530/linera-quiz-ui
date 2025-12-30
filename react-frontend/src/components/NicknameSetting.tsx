import React, { useState } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import useNotification from '../hooks/useNotification';
import { SET_NICKNAME } from '../graphql/quizMutations';
import { useUser } from '../contexts/UserContext';

interface NicknameSettingProps {
  onNicknameSet?: () => void;
}

const NicknameSetting: React.FC<NicknameSettingProps> = ({ onNicknameSet }) => {
  const { queryApplication } = useConnection();
  const { user, fetchUser } = useUser();
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSettingNickname, setIsSettingNickname] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const { success, error } = useNotification();

  // Check if user has a nickname
  const hasNickname = user?.nickname;

  // Handle nickname submission
  const handleSetNickname = async () => {
    if (!nicknameInput.trim()) {
      error('昵称不能为空');
      return;
    }

    try {
      setIsSettingNickname(true);

      await queryApplication({
        query: SET_NICKNAME,
        variables: {
          field0: {
            nickname: nicknameInput.trim(),
          },
        },
      });

      success('昵称设置成功');
      await fetchUser(); // 刷新全局用户信息
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
