/**
 * usePortalNotifications – Background polling for new client portal activity.
 *
 * - Polls /api/v1/portal/unseen/{projectId} for each active project with portal enabled.
 * - Compares with previous unseen counts: if increased → new activity.
 * - Fires an in-app notification via useNotificationStore.
 * - Runs every 90 seconds to be lightweight.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useProjects } from '../services/queries';
import { useNotificationStore } from '../stores/useNotificationStore';
import { apiFetch } from '../services/api';
import { useAuthStore } from '../stores';

interface UnseenState {
    [projectId: string]: { comments: number; files: number };
}

export function usePortalNotifications() {
    const { data: projects = [] } = useProjects();
    const addNotification = useNotificationStore(s => s.addNotification);
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);

    const prevRef = useRef<UnseenState>({});
    const initialDone = useRef(false);

    const checkUnseen = useCallback(async () => {
        if (!isAuthenticated) return;

        // Only check projects with portal enabled
        const portalProjects = projects.filter(p => p.portalSettings?.enabled);
        if (portalProjects.length === 0) return;

        for (const project of portalProjects) {
            try {
                const res = await apiFetch(`/api/v1/portal/unseen/${project.id}`);
                if (!res.ok) continue;
                const data = await res.json();
                const key = project.id;
                const prev = prevRef.current[key] || { comments: 0, files: 0 };

                if (initialDone.current) {
                    if (data.comments > prev.comments) {
                        const diff = data.comments - prev.comments;
                        addNotification(
                            `💬 ${diff > 1 ? `${diff} nouveaux commentaires` : 'Nouveau commentaire'}`,
                            `Portail de ${project.clientName}`,
                            'info',
                            `/client/${encodeURIComponent(project.id)}`,
                        );
                    }
                    if (data.files > prev.files) {
                        const diff = data.files - prev.files;
                        addNotification(
                            `📎 ${diff > 1 ? `${diff} nouveaux fichiers` : 'Nouveau fichier reçu'}`,
                            `Portail de ${project.clientName}`,
                            'info',
                            `/client/${encodeURIComponent(project.id)}`,
                        );
                    }
                }

                prevRef.current[key] = { comments: data.comments, files: data.files };
            } catch {
                // silent
            }
        }

        initialDone.current = true;
    }, [projects, isAuthenticated, addNotification]);

    // Run on mount and every 90 seconds
    useEffect(() => {
        checkUnseen();
        const interval = setInterval(checkUnseen, 90_000);
        return () => clearInterval(interval);
    }, [checkUnseen]);
}
