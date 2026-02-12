/**
 * Notification Store - Notifications and toast management
 */

import { create } from 'zustand';
import { Notification, NotificationType } from '../types';

interface NotificationState {
    notifications: Notification[];
    toasts: Notification[];
    
    // Actions
    addNotification: (title: string, message: string, type?: NotificationType, link?: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
    removeToast: (id: string) => void;
    
    // Computed
    unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    toasts: [],

    addNotification: (title, message, type = 'info', link?) => {
        const notification: Notification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type,
            title,
            message,
            timestamp: new Date(),
            read: false,
            link,
        };

        set(state => ({
            notifications: [notification, ...state.notifications].slice(0, 50),
            toasts: [...state.toasts, notification],
        }));

        // Auto-remove toast after 5 seconds
        setTimeout(() => {
            set(state => ({
                toasts: state.toasts.filter(t => t.id !== notification.id)
            }));
        }, 5000);
    },

    markAsRead: (id) => {
        set(state => ({
            notifications: state.notifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            )
        }));
    },

    markAllAsRead: () => {
        set(state => ({
            notifications: state.notifications.map(n => ({ ...n, read: true }))
        }));
    },

    removeNotification: (id) => {
        set(state => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }));
    },

    clearAll: () => set({ notifications: [] }),

    removeToast: (id) => {
        set(state => ({
            toasts: state.toasts.filter(t => t.id !== id)
        }));
    },

    unreadCount: () => get().notifications.filter(n => !n.read).length,
}));
