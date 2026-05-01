/**
 * useUpdateChecker — Polls GitHub via the backend to detect new app versions
 * and pushes a single in-app notification per release.
 *
 * Strategy:
 *  - First check 8 seconds after mount (don't slow down boot)
 *  - Re-check every hour while the app is open
 *  - Persists the last "notified" version in localStorage so Marion is
 *    notified ONCE per release (not on every poll/reload).
 *  - The notification deep-links to the GitHub release page so Marion can
 *    read the changelog directly.
 */
import { useEffect, useRef } from 'react';
import { useNotificationStore } from '../stores';
import { apiFetch } from '../services/api';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
const FIRST_CHECK_DELAY_MS = 8000;
const NOTIFIED_KEY = 'marion_update_notified_version';

interface UpdateCheckResponse {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseName?: string;
    releaseNotes?: string;
    htmlUrl?: string;
    publishedAt?: string;
    error?: string;
}

export function useUpdateChecker() {
    const addNotification = useNotificationStore((s) => s.addNotification);
    const lastChecked = useRef<number>(0);

    useEffect(() => {
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const check = async () => {
            // Don't spam the GitHub API
            if (Date.now() - lastChecked.current < 5 * 60 * 1000) return;
            lastChecked.current = Date.now();

            try {
                const res = await apiFetch('/api/v1/updates/check');
                if (!res.ok || cancelled) return;
                const data: UpdateCheckResponse = await res.json();

                if (!data.updateAvailable || !data.latestVersion) return;

                const alreadyNotified = localStorage.getItem(NOTIFIED_KEY);
                if (alreadyNotified === data.latestVersion) return;

                addNotification(
                    `Mise à jour disponible (v${data.latestVersion})`,
                    data.releaseName
                        ? `${data.releaseName} — clique pour voir les nouveautés sur GitHub`
                        : `Tu utilises actuellement la v${data.currentVersion}. Clique pour voir le changelog sur GitHub.`,
                    'info',
                    data.htmlUrl
                        || `https://github.com/VilaJo/Marion-Web-OS-v2/releases/tag/v${data.latestVersion}`,
                );

                localStorage.setItem(NOTIFIED_KEY, data.latestVersion);
            } catch {
                // Network down or backend off — fail silently, retry next tick
            }
        };

        // First check after a short delay so we don't compete with app boot
        const firstTimer = setTimeout(check, FIRST_CHECK_DELAY_MS);
        // Hourly polling
        intervalId = setInterval(check, CHECK_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearTimeout(firstTimer);
            if (intervalId) clearInterval(intervalId);
        };
    }, [addNotification]);
}
