/**
 * useEmailNotifications – Background polling for new emails.
 *
 * - Polls /api/v1/email/unseen every 60 s (via React Query).
 * - Compares with previous unseen count: if it increased → new mail.
 * - Fires an in-app notification (via useNotificationStore).
 * - Fires a native browser Notification (with permission request).
 * - Plays a short notification sound.
 * - Invalidates the inbox query so the email widget stays in sync.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEmailStatus, useEmailUnseen, emailKeys } from '../services/queries';
import { useNotificationStore } from '../stores/useNotificationStore';

/** Truncate long strings for the notification body */
function truncate(str: string, max = 80): string {
    if (str.length <= max) return str;
    return str.slice(0, max) + '…';
}

/** Parse a "From" header → human-readable name */
function senderName(raw: string): string {
    // "Johan Doe <j@test.com>"  →  "Johan Doe"
    const match = raw.match(/^"?([^"<]+)"?\s*</);
    if (match) return match[1].trim();
    // fallback: just email
    return raw.replace(/<.*>/, '').trim() || raw;
}

export function useEmailNotifications() {
    const queryClient = useQueryClient();
    const addNotification = useNotificationStore(s => s.addNotification);

    // Track the last-known unseen count to detect *new* arrivals
    const prevCountRef = useRef<number | null>(null);
    // Avoid firing notifications on first load
    const initialLoadDone = useRef(false);

    // ----- Connection status (lightweight, cached) -----
    const { data: statusData } = useEmailStatus();
    const isConnected = statusData?.connected ?? false;

    // ----- Unseen count polling -----
    const { data: unseenData } = useEmailUnseen(isConnected);

    // ----- Request native notification permission once -----
    useEffect(() => {
        if (isConnected && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [isConnected]);

    // ----- Play a short chime -----
    const playSound = useCallback(() => {
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch {
            // AudioContext not available – silent fallback
        }
    }, []);

    // ----- React to unseen count changes -----
    useEffect(() => {
        if (!unseenData || !isConnected) return;

        const count = unseenData.count ?? 0;

        // First poll → just store the baseline
        if (!initialLoadDone.current) {
            prevCountRef.current = count;
            initialLoadDone.current = true;
            return;
        }

        const prev = prevCountRef.current ?? 0;
        prevCountRef.current = count;

        // Only notify if count increased (new mail arrived)
        if (count > prev) {
            const diff = count - prev;
            const newest = unseenData.newest;

            // Build notification text
            const title = diff === 1
                ? `📧 Nouvel email${newest ? ` de ${senderName(newest.from)}` : ''}`
                : `📧 ${diff} nouveaux emails`;
            const body = newest?.subject
                ? truncate(newest.subject)
                : `${diff} message${diff > 1 ? 's' : ''} non lu${diff > 1 ? 's' : ''}`;

            // 1. In-app notification
            addNotification(title, body, 'info', '/emails');

            // 2. Native browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(title, {
                        body,
                        icon: '/logo_marion.png',
                        tag: 'marion-email', // replaces previous if still visible
                    });
                } catch {
                    // Silent fallback
                }
            }

            // 3. Sound
            playSound();

            // 4. Refresh inbox list so user sees the new messages immediately
            queryClient.invalidateQueries({ queryKey: emailKeys.list('inbox') });
        }
    }, [unseenData, isConnected, addNotification, playSound, queryClient]);
}
