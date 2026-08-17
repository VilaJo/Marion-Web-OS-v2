import { describe, expect, it } from 'vitest';
import { calendarTypeToTodoCategory, buildCalendarTodosForDay, migrateLegacyTodoCategory } from '../../utils/todoCalendarSync';
import { CalendarEvent } from '../../types';

describe('todoCalendarSync', () => {
    it('maps calendar types to todo categories', () => {
        expect(calendarTypeToTodoCategory('Call ou rdv pro')).toBe('Rendez-vous');
        expect(calendarTypeToTodoCategory('To do pro')).toBe('Client');
        expect(calendarTypeToTodoCategory('Deadlines')).toBe('Deadlines');
        expect(calendarTypeToTodoCategory('Facturation')).toBe('Facturation');
        expect(calendarTypeToTodoCategory('Maintenances')).toBe('Facturation');
        expect(calendarTypeToTodoCategory('Perso')).toBe('Perso');
    });

    it('migrates Finance → Facturation', () => {
        expect(migrateLegacyTodoCategory('Finance')).toBe('Facturation');
    });

    it('builds todos for a given day', () => {
        const events: CalendarEvent[] = [
            { id: '1', title: 'Call Olivier', date: '2026-08-17', startTime: '14:00', duration: 30, type: 'Call ou rdv pro' },
            { id: '2', title: 'Autre jour', date: '2026-08-18', startTime: '10:00', duration: 30, type: 'Perso' },
        ];
        const todos = buildCalendarTodosForDay(events, '2026-08-17');
        expect(todos).toHaveLength(1);
        expect(todos[0].id).toBe('cal-1');
        expect(todos[0].text).toContain('Call Olivier');
        expect(todos[0].category).toBe('Rendez-vous');
    });
});
