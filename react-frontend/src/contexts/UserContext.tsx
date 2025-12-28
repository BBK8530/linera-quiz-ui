import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useConnection } from './ConnectionContext';
import { GET_USER } from '../graphql/quizQueries';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

interface User {
  nickname: string | null;
  walletAddress: string | null;
  [key: string]: any;
}

interface UserContextType {
  user: User;
  setUser: (userData: Partial<User>) => void;
  fetchUser: () => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUserState] = useState<User>({
    nickname: null,
    walletAddress: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { queryApplication, onNewBlock, offNewBlock } = useConnection();
  const { primaryWallet } = useDynamicContext();

  const setUser = useCallback((userData: Partial<User>) => {
    setUserState(prev => ({ ...prev, ...userData }));
  }, []);

  const fetchUser = useCallback(async () => {
    if (!primaryWallet?.address) {
      console.log('Primary wallet address is null or undefined');
      return;
    }

    try {
      setIsLoading(true);
      console.log(
        'Fetching user data with wallet address:',
        primaryWallet.address,
      );
      const result = (await queryApplication({
        query: GET_USER,
        variables: { walletAddress: primaryWallet.address.toLowerCase() },
      })) as { data?: { user: User | null } };
      console.log('User query result:', result.data);
      const userData = result?.data?.user || {
        nickname: null,
        walletAddress: null,
      };
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [primaryWallet?.address, queryApplication, setUser]);

  // 订阅新区块事件以刷新用户数据
  useEffect(() => {
    onNewBlock(fetchUser);
    return () => offNewBlock(fetchUser);
  }, [fetchUser, onNewBlock, offNewBlock]);

  return (
    <UserContext.Provider value={{ user, setUser, fetchUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
