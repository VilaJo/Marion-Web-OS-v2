/**
 * useOAuthMonitor - Monitors Google OAuth connection status at app startup
 * and periodically. Shows a notification when the connection is lost,
 * prompting the user to reconnect.
 */

import { useEffect, useRef } from 'react';
import { useOAuthStatus } from '../services/queries';
import { useNotificationStore } from '../stores';

export function useOAuthMonitor() {
    const { data: oauthStatus } = useOAuthStatus();
    const addNotification = useNotificationStore(s => s.addNotification);
    const lastConnected = useRef<boolean | null>(null);
    const notifiedDisconnect = useRef(false);

    useEffect(() => {
        if (!oauthStatus) return;

        const wasConnected = lastConnected.current;
        const isConnected = oauthStatus.connected;

        // Detect transition from connected -> disconnected
        if (wasConnected === true && !isConnected && !notifiedDisconnect.current) {
            notifiedDisconnect.current = true;
            addNotification(
                'Google déconnecté',
                'L\'Agenda et le Drive sont déconnectés. Reconnectez-vous dans l\'Agenda.',
                'warning',
                '/settings',
            );
        }

        // On first load, if disconnected and there was a previous email (token exists but expired)
        if (wasConnected === null && !isConnected && oauthStatus.email && !notifiedDisconnect.current) {
            notifiedDisconnect.current = true;
            addNotification(
                'Google déconnecté',
                `Le compte ${oauthStatus.email} nécessite une reconnexion.`,
                'warning',
                '/settings',
            );
        }

        // Reset notification flag when reconnected
        if (isConnected) {
            if (notifiedDisconnect.current) {
                addNotification(
                    'Google reconnecté',
                    `Connecté à ${oauthStatus.email}`,
                    'success',
                );
            }
            notifiedDisconnect.current = false;
        }

        lastConnected.current = isConnected;
    }, [oauthStatus, addNotification]);
}
