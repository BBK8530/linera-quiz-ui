import React from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import useNotification from '../hooks/useNotification';
import type { NotificationType } from '../types/NotificationTypes';

interface NotificationProps {
  id: string;
  type: NotificationType;
  message: string;
  onClose?: () => void;
}

const Notification: React.FC<NotificationProps> = ({ id, type, message, onClose }) => {
  const { removeNotification } = useNotification();

  const handleClose = () => {
    removeNotification(id);
    if (onClose) onClose();
  };

  // Get icon based on notification type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className="notification-icon" />;
      case 'error':
        return <FaExclamationCircle className="notification-icon" />;
      case 'warning':
        return <FaExclamationTriangle className="notification-icon" />;
      case 'info':
        return <FaInfoCircle className="notification-icon" />;
      default:
        return null;
    }
  };

  return (
    <div className={`notification notification-${type}`}>
      {getIcon()}
      <span className="notification-message">{message}</span>
      <button className="notification-close" onClick={handleClose} aria-label="Close notification">
        <FaTimes size={16} />
      </button>
    </div>
  );
};

export default Notification;