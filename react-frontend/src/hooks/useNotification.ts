import { useContext } from 'react';
import { NotificationContext } from '../contexts/NotificationContext';
import type { NotificationContextType } from '../types/NotificationTypes';

const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotification must be used within a NotificationProvider',
    );
  }
  return context;
};

export default useNotification;
