import React, { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Notification, NotificationContextType } from '../types/NotificationTypes';
import { NotificationContext } from '../contexts/NotificationContext';


// Provider component
const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idCounter = useRef(0);

  // Add notification with deduplication
  const addNotification = (notification: Omit<Notification, 'id'>) => {
    // Generate ID using a counter instead of Date.now() and Math.random()
    idCounter.current += 1;
    const id = `notification-${idCounter.current}`;
    
    const newNotification: Notification = {
      id,
      ...notification,
      duration: notification.duration || 3000
    };

    // Use functional update to access latest notifications state
    setNotifications(prevNotifications => {
      // Debug: Log add notification attempt with latest state
      console.log('🔔 Add notification attempt:', notification, 'Current notifications:', prevNotifications);
      
      // Check if identical notification already exists in latest state
      const isDuplicate = prevNotifications.some(n => 
        n.type === notification.type && 
        n.message === notification.message
      );
      
      if (isDuplicate) {
        console.log('🔔 Skipping duplicate notification');
        return prevNotifications; // Return original state if duplicate
      }
      
      console.log('🔔 Adding notification:', newNotification);
      return [...prevNotifications, newNotification];
    });

    // Auto remove after duration if not specified otherwise
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }
  };

  // Remove notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Helper methods for different notification types
  const success = (message: string, options?: Omit<Omit<Notification, 'id'>, 'type'>) => {
    addNotification({ type: 'success', message, ...options });
  };

  const error = (message: string, options?: Omit<Omit<Notification, 'id'>, 'type'>) => {
    addNotification({ type: 'error', message, ...options });
  };

  const warning = (message: string, options?: Omit<Omit<Notification, 'id'>, 'type'>) => {
    addNotification({ type: 'warning', message, ...options });
  };

  const info = (message: string, options?: Omit<Omit<Notification, 'id'>, 'type'>) => {
    addNotification({ type: 'info', message, ...options });
  };

  // Context value
  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
