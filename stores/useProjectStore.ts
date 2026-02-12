/**
 * Project Store - Client-side state management
 * 
 * Owns: calendar events, activities, search/filter state, selected project.
 * Handles localStorage persistence for events & activities.
 * 
 * NOTE: Project data (CRUD) is now managed by React Query hooks (see services/queries.ts).
 * This store only holds client-side state that doesn't come from the server.
 */

import { create } from 'zustand';
import { Project, ProjectStatus, CalendarEvent, Activity, ActivityType } from '../types';

// ---------------------------------------------------------------------------
// Persistence Helpers
// ---------------------------------------------------------------------------

const EVENTS_KEY = 'marion_calendar_events';
const ACTIVITIES_KEY = 'marion_activities';

const persistEvents = (events: CalendarEvent[]) => {
    try {
        if (events.length === 0) return;
        const localEvents = events.filter(e => !e.source || e.source === 'local');
        localStorage.setItem(EVENTS_KEY, JSON.stringify(localEvents));
    } catch { /* ignore */ }
};

const persistActivities = (activities: Activity[]) => {
    try {
        localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities.slice(0, 100)));
    } catch { /* ignore */ }
};

const loadSavedEvents = (): CalendarEvent[] => {
    try {
        const saved = localStorage.getItem(EVENTS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch { /* ignore */ }
    return [];
};

const loadSavedActivities = (): Activity[] => {
    try {
        const saved = localStorage.getItem(ACTIVITIES_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch { /* ignore */ }
    return [];
};

// ---------------------------------------------------------------------------
// Store Interface
// ---------------------------------------------------------------------------

interface ProjectState {
    // Local Data (persisted to localStorage)
    events: CalendarEvent[];
    activities: Activity[];
    
    // UI State
    selectedProject: Project | null;
    filter: string;
    searchQuery: string;

    // Actions - Events (persisted to localStorage)
    setEvents: (events: CalendarEvent[]) => void;
    addEvent: (event: CalendarEvent) => void;
    updateEvent: (event: CalendarEvent) => void;
    deleteEvent: (eventId: string) => void;

    // Actions - Activities (persisted to localStorage)
    addActivity: (type: ActivityType, title: string, projectId?: string, projectName?: string, description?: string) => void;
    setActivities: (activities: Activity[]) => void;

    // Actions - UI
    setSelectedProject: (project: Project | null) => void;
    setFilter: (filter: string) => void;
    setSearchQuery: (query: string) => void;
}

// ---------------------------------------------------------------------------
// Store Implementation
// ---------------------------------------------------------------------------

export const useProjectStore = create<ProjectState>((set, get) => ({
    events: loadSavedEvents(),
    activities: loadSavedActivities(),
    selectedProject: null,
    filter: 'Tous',
    searchQuery: '',

    // -----------------------------------------------------------------------
    // Events (persisted)
    // -----------------------------------------------------------------------

    setEvents: (events) => {
        set({ events });
        persistEvents(events);
    },

    addEvent: (event) => {
        const newEvents = [...get().events, event];
        set({ events: newEvents });
        persistEvents(newEvents);
    },

    updateEvent: (event) => {
        const newEvents = get().events.map(e => e.id === event.id ? event : e);
        set({ events: newEvents });
        persistEvents(newEvents);
    },

    deleteEvent: (eventId) => {
        const newEvents = get().events.filter(e => e.id !== eventId);
        set({ events: newEvents });
        persistEvents(newEvents);
    },

    // -----------------------------------------------------------------------
    // Activities (persisted)
    // -----------------------------------------------------------------------

    addActivity: (type, title, projectId, projectName, description) => {
        const activity: Activity = {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type,
            title,
            description,
            projectId,
            projectName,
            timestamp: new Date().toISOString(),
        };
        const newActivities = [activity, ...get().activities].slice(0, 100);
        set({ activities: newActivities });
        persistActivities(newActivities);
    },

    setActivities: (activities) => {
        set({ activities });
        persistActivities(activities);
    },

    // -----------------------------------------------------------------------
    // UI State
    // -----------------------------------------------------------------------

    setSelectedProject: (project) => set({ selectedProject: project }),
    setFilter: (filter) => set({ filter }),
    setSearchQuery: (query) => set({ searchQuery: query }),
}));
