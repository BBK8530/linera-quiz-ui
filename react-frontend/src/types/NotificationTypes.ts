// Notification type definition
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number; // in milliseconds, default: 3000
  onClose?: () => void;
}

// Notification context interface
export interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  success: (
    message: string,
    options?: Omit<Omit<Notification, 'id'>, 'type'>,
  ) => void;
  error: (
    message: string,
    options?: Omit<Omit<Notification, 'id'>, 'type'>,
  ) => void;
  warning: (
    message: string,
    options?: Omit<Omit<Notification, 'id'>, 'type'>,
  ) => void;
  info: (
    message: string,
    options?: Omit<Omit<Notification, 'id'>, 'type'>,
  ) => void;
}
