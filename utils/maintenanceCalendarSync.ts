/**
 * Sync fiche maintenance client → événements calendrier (type Maintenances).
 */

import { CalendarEvent, MaintenanceInfo, Project } from '../types';

const EVENT_PREFIX = 'maint-auto';

export function maintenanceEventId(projectId: string, kind: 'offered' | 'billing', date: string): string {
    const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    return `${EVENT_PREFIX}-${safeProject}-${kind}-${date}`;
}

export function isAutoMaintenanceEventId(id: string): boolean {
    return id.startsWith(`${EVENT_PREFIX}-`);
}

function buildEvent(
    id: string,
    title: string,
    date: string,
    project: Project,
): CalendarEvent {
    return {
        id,
        title,
        date,
        startTime: '09:00',
        duration: 60,
        type: 'Maintenances',
        source: 'local',
        description: project.clientName,
    };
}

/**
 * Crée / met à jour / supprime les événements Maintenances liés à la fiche.
 * Retourne la liste des IDs d’événements actifs.
 */
export function syncMaintenanceCalendarEvents(
    project: Project,
    maintenance: MaintenanceInfo,
    existingEvents: CalendarEvent[],
    actions: {
        addEvent: (e: CalendarEvent) => void;
        updateEvent: (e: CalendarEvent) => void;
        deleteEvent: (id: string) => void;
    },
): string[] {
    const desired = new Map<string, CalendarEvent>();

    if (maintenance.active) {
        const mode = maintenance.mode || (maintenance.freeMaintenanceEndDate ? 'offered' : 'billing');
        if (mode === 'offered' && maintenance.freeMaintenanceEndDate) {
            const date = maintenance.freeMaintenanceEndDate;
            const id = maintenanceEventId(project.id, 'offered', date);
            const price =
                maintenance.monthlyPrice != null && maintenance.monthlyPrice > 0
                    ? ` · puis ${maintenance.monthlyPrice}`
                    : '';
            desired.set(
                id,
                buildEvent(
                    id,
                    `Fin maintenance offerte — ${project.clientName}${price}`,
                    date,
                    project,
                ),
            );
        }
        if (mode === 'billing') {
            const dates = [
                ...(maintenance.billingDate ? [maintenance.billingDate] : []),
                ...(maintenance.billingDates || []),
            ];
            const unique = [...new Set(dates.filter(Boolean))];
            unique.forEach((date) => {
                const id = maintenanceEventId(project.id, 'billing', date);
                const cost =
                    maintenance.monthlyPrice != null && maintenance.monthlyPrice > 0
                        ? ` · ${maintenance.monthlyPrice}`
                        : '';
                desired.set(
                    id,
                    buildEvent(
                        id,
                        `Facturation maintenance — ${project.clientName}${cost}`,
                        date,
                        project,
                    ),
                );
            });
        }
    }

    const existingAuto = existingEvents.filter(
        (e) =>
            isAutoMaintenanceEventId(e.id) &&
            (e.id.includes(project.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)) ||
                (e.description === project.clientName && e.type === 'Maintenances')),
    );

    // Also match by id prefix for this project
    const projectSafe = project.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const related = existingEvents.filter(
        (e) => e.id.startsWith(`${EVENT_PREFIX}-${projectSafe}-`),
    );

    const relatedIds = new Set([...existingAuto, ...related].map((e) => e.id));

    relatedIds.forEach((id) => {
        if (!desired.has(id)) {
            actions.deleteEvent(id);
        }
    });

    const activeIds: string[] = [];
    desired.forEach((event, id) => {
        activeIds.push(id);
        const existing = existingEvents.find((e) => e.id === id);
        if (existing) {
            if (
                existing.title !== event.title ||
                existing.date !== event.date ||
                existing.type !== event.type
            ) {
                actions.updateEvent({ ...existing, ...event });
            }
        } else {
            actions.addEvent(event);
        }
    });

    return activeIds;
}
