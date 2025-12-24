import { createContext } from 'react';
import type { NotificationContextType } from '../types/NotificationTypes';

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
