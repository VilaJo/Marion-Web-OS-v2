/**
 * Sync événements calendrier du jour → to-do (catégories alignées).
 */

import { CalendarEvent } from '../types';
import { DailyTodo, TodoCategory } from '../stores/useTodoStore';

export const TODO_CATEGORIES: TodoCategory[] = [
    'Rendez-vous',
    'Client',
    'Deadlines',
    'Facturation',
    'Perso',
];

/** Couleurs alignées sur Agenda (GCAL_CATEGORIES). */
export const TODO_CATEGORY_COLORS: Record<TodoCategory, { color: string; badge: string }> = {
    'Rendez-vous': { color: '#039BE5', badge: 'text-[#039BE5] bg-[#039BE5]/10' },
    Client: { color: '#3F51B5', badge: 'text-[#3F51B5] bg-[#3F51B5]/10' },
    Deadlines: { color: '#D50000', badge: 'text-[#D50000] bg-[#D50000]/10' },
    Facturation: { color: '#b8860b', badge: 'text-[#b8860b] bg-[#F6BF26]/15' },
    Perso: { color: '#8E24AA', badge: 'text-[#8E24AA] bg-[#8E24AA]/10' },
};

export function calendarTypeToTodoCategory(type: CalendarEvent['type'] | string): TodoCategory {
    switch (type) {
        case 'Call ou rdv pro':
            return 'Rendez-vous';
        case 'To do pro':
            return 'Client';
        case 'Deadlines':
            return 'Deadlines';
        case 'Facturation':
        case 'Maintenances':
            return 'Facturation';
        case 'Perso':
        case 'Anniversaire':
        case 'Sport':
            return 'Perso';
        default:
            return 'Client';
    }
}

export function calendarTodoId(eventId: string): string {
    return `cal-${eventId}`;
}

export function isCalendarLinkedTodoId(id: string): boolean {
    return id.startsWith('cal-');
}

function todayIso(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Pour chaque événement du jour, upsert une to-do liée.
 * Ne touche pas aux to-dos manuelles. Met à jour titre/catégorie des to-dos cal-*.
 * Retourne la liste des ids cal-* attendus aujourd’hui.
 */
export function buildCalendarTodosForDay(
    events: CalendarEvent[],
    day: string = todayIso(),
): Array<Omit<DailyTodo, 'done'> & { done?: boolean }> {
    return events
        .filter((e) => e.date === day && !e.id.startsWith('reminder-'))
        .slice()
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        .map((e) => {
            const time = e.startTime ? `${e.startTime}` : '';
            const text = time ? `${time} · ${e.title}` : e.title;
            return {
                id: calendarTodoId(e.id),
                text,
                category: calendarTypeToTodoCategory(e.type),
                remindAt: e.startTime || undefined,
                done: false,
            };
        });
}

export function migrateLegacyTodoCategory(cat?: string): TodoCategory | undefined {
    if (!cat) return undefined;
    if (cat === 'Finance') return 'Facturation';
    if ((TODO_CATEGORIES as string[]).includes(cat)) return cat as TodoCategory;
    return 'Perso';
}
