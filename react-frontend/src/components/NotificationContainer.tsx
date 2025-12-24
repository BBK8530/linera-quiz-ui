import React from 'react';
import useNotification from '../hooks/useNotification';
import Notification from './Notification';

const NotificationContainer: React.FC = () => {
  const { notifications } = useNotification();

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          id={notification.id}
          type={notification.type}
          message={notification.message}
          onClose={notification.onClose}
        />
      ))}
    </div>
  );
};

export default NotificationContainer;