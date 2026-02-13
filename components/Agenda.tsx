import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '../types';
import { Modal, Badge, Tooltip } from './Shared';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, Clock, Video, Copy, Star, Trash2, AlertCircle, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, MapPin, Minimize2, Maximize2, X, Settings, ArrowRight, Globe, Map as MapIcon } from 'lucide-react';
import { toZonedTime, format, formatInTimeZone } from 'date-fns-tz';
import { fr } from 'date-fns/locale';
import { addMinutes, differenceInMinutes, parse, isBefore, startOfDay, parseISO } from 'date-fns';
import { useCalendarSync, useGoogleCalendarEvents, useCreateGoogleEvent, useUpdateGoogleEvent, useConnectGoogle, queryKeys } from '../services/queries';
import { useQueryClient } from '@tanstack/react-query';

interface AgendaProps {
    events: CalendarEvent[];
    onAddEvent: (event: CalendarEvent) => void;
    onUpdateEvent: (event: CalendarEvent) => void;
    onDeleteEvent: (eventId: string) => void;
}

interface EventTypeBadgeProps {
    type: string;
    selected?: boolean;
    onClick?: () => void;
}

const EventTypeBadge: React.FC<EventTypeBadgeProps> = React.memo(({ type, selected, onClick }) => {
    const colors: Record<string, string> = {
        'Meeting': 'bg-blue-100 text-blue-700 border-blue-200',
        'Deadline': 'bg-red-100 text-red-700 border-red-200',
        'Focus': 'bg-purple-100 text-purple-700 border-purple-200',
        'Personal': 'bg-green-100 text-green-700 border-green-200',
    };
    return (
        <div 
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer transition-all ${colors[type]} ${selected ? 'ring-2 ring-offset-2 ring-slate-400' : 'opacity-60 hover:opacity-100'}`}
        >
            {type}
        </div>
    );
});

// --- Timezone Generation (optimized - base list generated once) ---
const BASE_TIMEZONES: { value: string; city: string; region: string; search: string }[] = (() => {
    if (typeof Intl === 'undefined' || !Intl.supportedValuesOf) return [];
    try {
        return Intl.supportedValuesOf('timeZone').map(tz => {
            const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
            const region = tz.split('/')[0].replace(/_/g, ' ') || '';
            return { value: tz, city, region, search: `${city} ${region} ${tz}`.toLowerCase() };
        }).sort((a, b) => a.city.localeCompare(b.city));
    } catch { return []; }
})();

// Only format with current time when needed (lazy)
const formatTimezoneWithTime = (tz: typeof BASE_TIMEZONES[0], date: Date) => {
    try {
        const nowInTz = toZonedTime(date, tz.value);
        const offset = format(nowInTz, 'xxx', { timeZone: tz.value });
        const time = format(nowInTz, 'HH:mm', { timeZone: tz.value });
        return { ...tz, label: `${tz.city} (${time}) ${offset} - ${tz.region}` };
    } catch {
        return { ...tz, label: `${tz.city} - ${tz.region}` };
    }
};

// --- Constants ---
const START_HOUR = 0; 
const END_HOUR = 23; 
const HOURS_COUNT = END_HOUR - START_HOUR + 1;
const PIXELS_PER_HOUR = 80;

// Favorites at the top, then varied timezones (no duplicates)
const COMMON_CITIES = [
    // ⭐ Favorites
    { name: 'Genève', tz: 'Europe/Zurich', country: '🇨🇭', favorite: true },
    { name: 'Mexico City', tz: 'America/Mexico_City', country: '🇲🇽', favorite: true },
    { name: 'Athènes', tz: 'Europe/Athens', country: '🇬🇷', favorite: true },
    // Other timezones (varied)
    { name: 'London', tz: 'Europe/London', country: '🇬🇧', favorite: false },
    { name: 'New York', tz: 'America/New_York', country: '🇺🇸', favorite: false },
    { name: 'Tokyo', tz: 'Asia/Tokyo', country: '🇯🇵', favorite: false },
    { name: 'Dubai', tz: 'Asia/Dubai', country: '🇦🇪', favorite: false },
    { name: 'Sydney', tz: 'Australia/Sydney', country: '🇦🇺', favorite: false },
    { name: 'Los Angeles', tz: 'America/Los_Angeles', country: '🇺🇸', favorite: false },
    { name: 'São Paulo', tz: 'America/Sao_Paulo', country: '🇧🇷', favorite: false },
    { name: 'Singapore', tz: 'Asia/Singapore', country: '🇸🇬', favorite: false },
];

const AgendaInner: React.FC<AgendaProps> = ({ events: localEvents, onAddEvent, onUpdateEvent, onDeleteEvent }) => {
    // === React Query hooks for external calendar data ===
    const { data: syncStatus } = useCalendarSync();
    const { data: gcalEvents = [], isFetching: isSyncingGcal } = useGoogleCalendarEvents();
    const createGoogleEventMutation = useCreateGoogleEvent();
    const updateGoogleEventMutation = useUpdateGoogleEvent();
    const connectGoogleMutation = useConnectGoogle();
    const queryClient = useQueryClient();

    // Reconnect handler — opens OAuth popup
    const handleReconnect = useCallback(() => {
        connectGoogleMutation.mutate(undefined, {
            onSuccess: (data: any) => {
                const popup = window.open(data.auth_url, 'Google Auth', 'width=500,height=600,left=200,top=100');
                const handleMessage = (event: MessageEvent) => {
                    if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                        localStorage.setItem('marion_gcal_connected', 'true');
                        if (event.data.email) localStorage.setItem('marion_gcal_email', event.data.email);
                        queryClient.invalidateQueries({ queryKey: queryKeys.calendarSync });
                        queryClient.invalidateQueries({ queryKey: queryKeys.events });
                        queryClient.invalidateQueries({ queryKey: queryKeys.oauthStatus });
                        window.removeEventListener('message', handleMessage);
                    }
                    if (event.data.type === 'GOOGLE_AUTH_ERROR') {
                        window.removeEventListener('message', handleMessage);
                    }
                };
                window.addEventListener('message', handleMessage);
                const checkClosed = setInterval(() => {
                    if (popup?.closed) { clearInterval(checkClosed); window.removeEventListener('message', handleMessage); }
                }, 1000);
            },
        });
    }, [connectGoogleMutation, queryClient]);

    // Helper to map Google events from API
    const mapGoogleEvent = useCallback((e: any): CalendarEvent => ({
        id: `gcal-${e.googleEventId}`,
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        duration: e.duration || 60,
        type: 'Meeting' as const,
        description: e.description,
        meetLink: e.meetLink,
        source: 'google' as const,
        googleEventId: e.googleEventId,
        originalTimezone: e.originalTimezone,
        originalDateTime: e.originalDateTime
    }), []);

    // Compute external events from React Query data
    const externalEvents = useMemo(() => {
        const allEvents: CalendarEvent[] = [];
        
        // Add Google Calendar events
        if (gcalEvents.length > 0) {
            allEvents.push(...gcalEvents.map(mapGoogleEvent));
        }
        
        return allEvents;
    }, [gcalEvents, mapGoogleEvent]);
    
    // Calendar source visibility filters
    const [visibleSources, setVisibleSources] = useState<{ local: boolean, google: boolean }>({ local: true, google: true });

    // Merge local and external events for display (avoiding duplicates)
    const allMergedEvents = useMemo(() => {
        // Get IDs of local events that are synced to Google (have googleEventId)
        const syncedGoogleIds = new Set(
            localEvents
                .filter(e => e.googleEventId)
                .map(e => e.googleEventId)
        );
        
        // Filter out external Google events that already exist locally
        const filteredExternal = externalEvents.filter(e => {
            if (e.source === 'google' && e.googleEventId) {
                return !syncedGoogleIds.has(e.googleEventId);
            }
            return true;
        });
        
        return [...localEvents, ...filteredExternal];
    }, [localEvents, externalEvents]);

    // Apply source visibility filter
    const events = useMemo(() => {
        return allMergedEvents.filter(e => {
            if (e.source === 'google') return visibleSources.google;
            return visibleSources.local; // local or undefined source
        });
    }, [allMergedEvents, visibleSources]);

    // Ensure initial dates are valid
    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date();
        return isNaN(d.getTime()) ? new Date() : d;
    }); 
    const [currentTime, setCurrentTime] = useState(() => {
        const d = new Date();
        return isNaN(d.getTime()) ? new Date() : d;
    }); 
    
    // Google Calendar sync state (derived from React Query)
    const googleCalendarConnected = syncStatus?.connected ?? localStorage.getItem('marion_gcal_connected') === 'true';
    const googleCalendarEmail = syncStatus?.email ?? localStorage.getItem('marion_gcal_email');
    const isSyncing = isSyncingGcal;
    const lastGoogleSync = gcalEvents.length > 0 ? new Date() : null;

    // Persist Google connection status to localStorage for instant UI on next load
    useEffect(() => {
        if (syncStatus?.connected !== undefined) {
            localStorage.setItem('marion_gcal_connected', String(syncStatus.connected));
            if (syncStatus.email) {
                localStorage.setItem('marion_gcal_email', syncStatus.email);
            }
        }
    }, [syncStatus]);

    // Listen for auth changes from Settings/OAuth popup to invalidate queries
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                localStorage.setItem('marion_gcal_connected', 'true');
                if (event.data.email) {
                    localStorage.setItem('marion_gcal_email', event.data.email);
                }
            }
            if (event.data.type === 'GOOGLE_AUTH_DISCONNECT') {
                localStorage.removeItem('marion_gcal_connected');
                localStorage.removeItem('marion_gcal_email');
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const [isExpanded, setIsExpanded] = useState(false); // Expanded = "Immersion Mode"
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day'); // Only used in expanded
    const [localTimezone, setLocalTimezone] = useState(() => {
        try {
            return localStorage.getItem('marion_agenda_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
            return 'UTC';
        }
    });
    const [customCity, setCustomCity] = useState<string | null>(() => {
        const saved = localStorage.getItem('marion_agenda_city');
        if (saved) return saved;
        // Default to "Genève" for Swiss timezone instead of "Zurich"
        if (localTimezone === 'Europe/Zurich') return 'Genève';
        return null;
    });
    const [viewTimezone, setViewTimezone] = useState<string>(localTimezone); 

    // Persist Timezone Settings
    useEffect(() => {
        localStorage.setItem('marion_agenda_timezone', localTimezone);
    }, [localTimezone]);

    useEffect(() => {
        if (customCity) localStorage.setItem('marion_agenda_city', customCity);
        else localStorage.removeItem('marion_agenda_city');
    }, [customCity]);

    // Modals & Forms
    const [showEventModal, setShowEventModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formError, setFormError] = useState('');
    const [eventForm, setEventForm] = useState<Partial<CalendarEvent>>({
        type: 'Meeting',
        startTime: '09:00',
        duration: 60,
        originalTimezone: localTimezone 
    });

    // Derived End Time state for the form UI
    const [endDateTime, setEndDateTime] = useState<{date: string, time: string}>({ date: '', time: '' });

    // Weather
    const [weather, setWeather] = useState<{ temp: number, code: number } | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);

    // Timezone Selection
    const [searchTimezoneQuery, setSearchTimezoneQuery] = useState('');
    const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
    const [locationSearchQuery, setLocationSearchQuery] = useState('');
    
    const [favoriteTimezones, setFavoriteTimezones] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('marion_favorite_timezones');
            return saved ? JSON.parse(saved) : [localTimezone]; 
        } catch {
            return [localTimezone];
        }
    });
    
    // User favorite cities (persisted)
    const [userFavoriteCities, setUserFavoriteCities] = useState<{name: string, tz: string, country: string}[]>(() => {
        try {
            const saved = localStorage.getItem('marion_favorite_cities');
            return saved ? JSON.parse(saved) : [
                { name: 'Genève', tz: 'Europe/Zurich', country: '🇨🇭' },
                { name: 'Mexico City', tz: 'America/Mexico_City', country: '🇲🇽' },
                { name: 'Athènes', tz: 'Europe/Athens', country: '🇬🇷' },
            ];
        } catch {
            return [
                { name: 'Genève', tz: 'Europe/Zurich', country: '🇨🇭' },
                { name: 'Mexico City', tz: 'America/Mexico_City', country: '🇲🇽' },
                { name: 'Athènes', tz: 'Europe/Athens', country: '🇬🇷' },
            ];
        }
    });
    
    // Refs
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const expandedGridRef = useRef<HTMLDivElement>(null);
    const timezoneInputRef = useRef<HTMLInputElement>(null);
    const timezoneDropdownRef = useRef<HTMLDivElement>(null);

    // --- Derived Data (optimized: only format timezones when dropdown is open) ---
    const filteredTimezones = useMemo(() => {
        if (!showTimezoneDropdown) return []; // Don't compute if dropdown closed
        const query = searchTimezoneQuery.toLowerCase();
        const now = new Date(); // Use fresh time only when dropdown is open
        let results = BASE_TIMEZONES
            .filter(tz => tz.search.includes(query))
            .slice(0, 100) // Limit results for performance
            .map(tz => formatTimezoneWithTime(tz, now));
        const favs = results.filter(tz => favoriteTimezones.includes(tz.value));
        const nonFavs = results.filter(tz => !favoriteTimezones.includes(tz.value));
        return [...favs, ...nonFavs]; 
    }, [searchTimezoneQuery, favoriteTimezones, showTimezoneDropdown]);

    const filteredLocationTimezones = useMemo(() => {
        if (!locationSearchQuery) return [];
        const query = locationSearchQuery.toLowerCase();
        const now = new Date();
        return BASE_TIMEZONES
            .filter(tz => tz.search.includes(query))
            .slice(0, 50)
            .map(tz => formatTimezoneWithTime(tz, now));
    }, [locationSearchQuery]);

    // Memoized event positions - only recalculate when events or viewTimezone changes
    const eventPositionsCache = useMemo(() => {
        const cache = new Map<string, { top: number; height: number; dateInView: string }>();
        events.forEach(ev => {
            // Determine which date this event falls on in the current view timezone
            let dateInView = ev.date; // Fallback to raw date
            let hours = 9, minutes = 0;
            
            if (ev.originalTimezone && ev.originalDateTime) {
                try {
                    // Convert from original timezone to view timezone
                    const zonedInOriginal = toZonedTime(ev.originalDateTime, ev.originalTimezone);
                    if (viewTimezone === ev.originalTimezone) {
                        // Same timezone: use the zoned date directly (avoid double-conversion)
                        dateInView = format(zonedInOriginal, 'yyyy-MM-dd');
                        hours = zonedInOriginal.getHours();
                        minutes = zonedInOriginal.getMinutes();
                    } else {
                        // Different timezone: convert to view timezone
                        const zonedInView = toZonedTime(zonedInOriginal, viewTimezone);
                        dateInView = format(zonedInView, 'yyyy-MM-dd');
                        hours = zonedInView.getHours();
                        minutes = zonedInView.getMinutes();
                    }
                } catch {
                    // Fallback: parse startTime directly
                    const [h, m] = (ev.startTime || '09:00').split(':').map(Number);
                    hours = isNaN(h) ? 9 : h;
                    minutes = isNaN(m) ? 0 : m;
                }
            } else {
                // No timezone info: use startTime directly
                const [h, m] = (ev.startTime || '09:00').split(':').map(Number);
                hours = isNaN(h) ? 9 : h;
                minutes = isNaN(m) ? 0 : m;
            }
            
            const totalMinutesFromStart = (hours - START_HOUR) * 60 + minutes;
            const top = (totalMinutesFromStart / 60) * PIXELS_PER_HOUR;
            const duration = ev.duration || 60; // Ensure duration is never 0/undefined
            const height = Math.max((duration / 60) * PIXELS_PER_HOUR, 20); // Minimum 20px
            
            cache.set(ev.id, { top, height, dateInView });
        });
        return cache;
    }, [events, viewTimezone]);

    // --- Effects ---
    useEffect(() => { localStorage.setItem('marion_favorite_timezones', JSON.stringify(favoriteTimezones)); }, [favoriteTimezones]);
    useEffect(() => { localStorage.setItem('marion_favorite_cities', JSON.stringify(userFavoriteCities)); }, [userFavoriteCities]);
    
    // Update current time every second for accurate clock display
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000); 
        return () => clearInterval(timer);
    }, []);

    // Sync EndDateTime state with EventForm when form changes (and not manually editing end)
    useEffect(() => {
        if (eventForm.date && eventForm.startTime && eventForm.duration !== undefined) {
            try {
                const startDateTime = parse(`${eventForm.date}T${eventForm.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
                const calculatedEnd = addMinutes(startDateTime, eventForm.duration);
                setEndDateTime({
                    date: format(calculatedEnd, 'yyyy-MM-dd'),
                    time: format(calculatedEnd, 'HH:mm')
                });
            } catch (e) {
                // Fallback or log error
                console.error("Error calculating end date/time from eventForm:", e);
            }
        }
    }, [eventForm.date, eventForm.startTime, eventForm.duration]);

    // Weather Fetching
    useEffect(() => {
        const fetchWeather = async () => {
            setLoadingWeather(true);
            setWeather(null);
            const fetchWithCoords = async (lat: number, lon: number) => {
                try {
                    const dateStr = format(currentDate, 'yyyy-MM-dd'); 
                    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max&timezone=${localTimezone}&start_date=${dateStr}&end_date=${dateStr}`);
                    const data = await response.json();
                    if (data.daily?.temperature_2m_max?.length > 0) {
                        setWeather({ temp: Math.round(data.daily.temperature_2m_max[0]), code: data.daily.weather_code[0] });
                    }
                } catch (e) { console.error("Weather error", e); } finally { setLoadingWeather(false); }
            };
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (p) => fetchWithCoords(p.coords.latitude, p.coords.longitude),
                    (err) => {
                        console.warn("Geolocation fallback to Geneva:", err.message);
                        fetchWithCoords(46.2044, 6.1432);
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
                );
            } else { fetchWithCoords(46.2044, 6.1432); }
        };
        fetchWeather();
    }, [currentDate, localTimezone]);

    // Original Time Calculation Logic (for Create/Edit)
    useEffect(() => {
        setFormError(''); 
        if (eventForm.date && eventForm.startTime && eventForm.originalTimezone) {
            const dateParts = eventForm.date.split('-').map(Number);
            const timeParts = eventForm.startTime.split(':').map(Number);
            
            if (dateParts.length !== 3 || timeParts.length !== 2) return;

            const [year, month, day] = dateParts;
            const [hours, minutes] = timeParts;

            try {
                const localDateFromComponents = new Date(year, month - 1, day, hours, minutes);
                if (isNaN(localDateFromComponents.getTime())) return;

                const zonedDateInOriginalTz = toZonedTime(localDateFromComponents, eventForm.originalTimezone);
                const originalISO = format(zonedDateInOriginalTz, `yyyy-MM-dd'T'HH:mm:ssXXX`, { timeZone: eventForm.originalTimezone });
                setEventForm(prev => ({ ...prev, originalDateTime: originalISO }));
            } catch (error: any) {
                setEventForm(prev => ({ ...prev, originalDateTime: undefined })); 
            }
        } else {
            setEventForm(prev => ({ ...prev, originalDateTime: undefined })); 
        }
    }, [eventForm.date, eventForm.startTime, eventForm.originalTimezone]);

    // Function to scroll to current time (or 7am as fallback for business hours)
    const scrollToCurrentTime = useCallback((smooth = true) => {
        const containers = [gridContainerRef.current, expandedGridRef.current].filter(Boolean);
        if (containers.length === 0) return;
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        // If current time is within visible range, scroll to it; otherwise scroll to 7am
        const targetMinutes = (hours >= START_HOUR && hours <= END_HOUR)
            ? (hours - START_HOUR) * 60 + minutes
            : (7 - START_HOUR) * 60;
        const top = (targetMinutes / 60) * PIXELS_PER_HOUR;
        containers.forEach(container => {
            if (container) {
                const offset = container.clientHeight / 3;
                container.scrollTo({ 
                    top: Math.max(0, top - offset), 
                    behavior: smooth ? 'smooth' : 'auto' 
                });
            }
        });
    }, []);

    // Auto-scroll to current time on mount and when date/expanded changes
    useEffect(() => {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => scrollToCurrentTime(false), 100);
        return () => clearTimeout(timer);
    }, []); // Only on mount

    useEffect(() => {
        // Delay for expanded mode DOM to render before scrolling
        const timer = setTimeout(() => scrollToCurrentTime(isExpanded ? false : true), isExpanded ? 150 : 0);
        return () => clearTimeout(timer);
    }, [currentDate, isExpanded, viewMode, scrollToCurrentTime]);

    // --- Helpers ---
    const toISODate = (date: Date) => {
        try {
            return format(date, 'yyyy-MM-dd');
        } catch {
            return format(new Date(), 'yyyy-MM-dd');
        }
    };
    
    const navigate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week' && isExpanded) newDate.setDate(newDate.getDate() + (direction * 7));
        else if (viewMode === 'month' && isExpanded) newDate.setMonth(newDate.getMonth() + direction);
        else newDate.setDate(newDate.getDate() + direction);
        setCurrentDate(newDate);
    };

    const getWeatherIcon = (code: number) => {
        if (code === 0) return <Sun size={18} className="text-yellow-500" />;
        if (code >= 1 && code <= 3) return <Cloud size={18} className="text-slate-400" />;
        if (code >= 51) return <CloudRain size={18} className="text-blue-400" />;
        if (code >= 71) return <CloudSnow size={18} className="text-cyan-300" />;
        if (code >= 95) return <CloudLightning size={18} className="text-purple-500" />;
        return <Sun size={18} className="text-yellow-500" />;
    };

    // --- Event Styling ---
    const getEventStyle = (type: string) => {
        switch (type) {
            case 'Meeting': return 'bg-blue-100 border-l-4 border-blue-500 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
            case 'Deadline': return 'bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/40 dark:text-red-200';
            case 'Focus': return 'bg-purple-100 border-l-4 border-purple-500 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200';
            case 'Personal': return 'bg-green-100 border-l-4 border-green-500 text-green-700 dark:bg-green-900/40 dark:text-green-200';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getEventDotColor = (type: string) => {
        switch (type) {
            case 'Meeting': return 'bg-blue-500';
            case 'Deadline': return 'bg-red-500';
            case 'Focus': return 'bg-purple-500';
            case 'Personal': return 'bg-green-500';
            default: return 'bg-slate-400';
        }
    };

    const getEventChipStyle = (type: string) => {
        switch (type) {
            case 'Meeting': return 'bg-blue-500 text-white dark:bg-blue-600';
            case 'Deadline': return 'bg-red-500 text-white dark:bg-red-600';
            case 'Focus': return 'bg-purple-500 text-white dark:bg-purple-600';
            case 'Personal': return 'bg-green-500 text-white dark:bg-green-600';
            default: return 'bg-slate-500 text-white';
        }
    };

    // --- Interaction Handlers ---
    const handleSaveEvent = () => {
        setFormError(''); 
        // Relaxed validation: check only visible fields
        if (!eventForm.title || !eventForm.date || !eventForm.startTime) {
            setFormError('Veuillez remplir tous les champs obligatoires.');
            return;
        }
        
        let finalEvent = { ...eventForm } as CalendarEvent;
        if (!finalEvent.id) finalEvent.id = `e-${Date.now()}`;
        
        // ALWAYS mark new events as local (for persistence) - override any stale source
        if (!isEditing) {
            finalEvent.source = 'local';
        } else if (!finalEvent.source) {
            finalEvent.source = 'local';
        }
        
        // Ensure duration is always set
        if (!finalEvent.duration || finalEvent.duration <= 0) {
            finalEvent.duration = 60;
        }
        
        // Ensure originalTimezone is always set
        if (!finalEvent.originalTimezone) {
            finalEvent.originalTimezone = viewTimezone || localTimezone || 'UTC';
        }
        
        // Ensure originalDateTime is set using formatInTimeZone for accuracy
        if (!finalEvent.originalDateTime && finalEvent.date && finalEvent.startTime) {
             try {
                 const tz = finalEvent.originalTimezone;
                 // Build an ISO-like string and use formatInTimeZone for proper timezone handling
                 const dateTimeStr = `${finalEvent.date}T${finalEvent.startTime}:00`;
                 const parsed = parse(dateTimeStr, "yyyy-MM-dd'T'HH:mm:ss", new Date());
                 finalEvent.originalDateTime = formatInTimeZone(parsed, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
             } catch (e) {
                 // Fallback: simple ISO string
                 console.warn("Date calculation fallback", e);
                 finalEvent.originalDateTime = `${finalEvent.date}T${finalEvent.startTime}:00`;
             }
        }

        if (isEditing) {
            onUpdateEvent(finalEvent);
            
            // Handle Google Calendar Update via React Query mutation
            if (finalEvent.source === 'google' && finalEvent.googleEventId) {
                updateGoogleEventMutation.mutate({
                    googleEventId: finalEvent.googleEventId,
                    event: {
                        title: finalEvent.title,
                        description: finalEvent.description,
                        date: finalEvent.date,
                        startTime: finalEvent.startTime,
                        duration: finalEvent.duration || 60,
                    },
                });
            }
        } else {
            onAddEvent(finalEvent);
            
            // Sync to Google Calendar if connected (except Personal events)
            if (googleCalendarConnected && finalEvent.type !== 'Personal') {
                createGoogleEventMutation.mutate(
                    {
                        title: finalEvent.title,
                        description: finalEvent.description || '',
                        date: finalEvent.date,
                        startTime: finalEvent.startTime,
                        duration: finalEvent.duration || 60,
                    },
                    {
                        onSuccess: (data) => {
                            if (data.success && data.event?.googleEventId) {
                                onUpdateEvent({ ...finalEvent, googleEventId: data.event.googleEventId });
                            }
                        },
                    }
                );
            }
            
            // Navigate to the event's date and scroll to its time
            setCurrentDate(parse(finalEvent.date, 'yyyy-MM-dd', new Date()));
            setTimeout(() => {
                if (gridContainerRef.current) {
                    const [h] = (finalEvent.startTime || '09:00').split(':').map(Number);
                    const targetTop = ((isNaN(h) ? 9 : h) - START_HOUR) * PIXELS_PER_HOUR;
                    gridContainerRef.current.scrollTo({ top: Math.max(0, targetTop - 60), behavior: 'smooth' });
                }
            }, 100);
        }
        
        setShowEventModal(false);
    };

    const [isGeneratingMeet, setIsGeneratingMeet] = useState(false);
    const generateMeet = useCallback(() => {
        if (!googleCalendarConnected) {
            setFormError('Connecte Google Calendar dans les paramètres pour générer un lien Meet.');
            return;
        }
        setIsGeneratingMeet(true);
        const title = eventForm.title || 'Réunion';
        const date = eventForm.date || toISODate(currentDate);
        const startTime = eventForm.startTime || '09:00';
        const duration = eventForm.duration || 60;
        createGoogleEventMutation.mutate(
            { title, date, startTime, duration, addMeet: true },
            {
                onSuccess: (data) => {
                    if (data.success && data.event?.meetLink) {
                        setEventForm(prev => ({
                            ...prev,
                            meetLink: data.event.meetLink,
                            googleEventId: data.event.googleEventId,
                        }));
                    } else {
                        setFormError('Impossible de créer le lien Meet. Réessaye.');
                    }
                    setIsGeneratingMeet(false);
                },
                onError: () => {
                    setFormError('Erreur lors de la création du lien Meet.');
                    setIsGeneratingMeet(false);
                },
            }
        );
    }, [googleCalendarConnected, eventForm.title, eventForm.date, eventForm.startTime, eventForm.duration, currentDate, createGoogleEventMutation]);

    const handleGridClick = (date: Date, hour: number) => {
        setFormError('');
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        const initialStartDate = toISODate(date);
        const initialStartTime = timeStr;
        const initialDuration = 60; // Default to 1 hour
        
        const startDateTime = parse(`${initialStartDate}T${initialStartTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
        const calculatedEnd = addMinutes(startDateTime, initialDuration);

        // Default to creating event in VIEW timezone to match what user sees
        setIsEditing(false);
        setEventForm({
            type: 'Meeting',
            startTime: initialStartTime,
            date: initialStartDate,
            duration: initialDuration,
            originalTimezone: viewTimezone, 
            title: ''
        });
        setEndDateTime({
            date: format(calculatedEnd, 'yyyy-MM-dd'),
            time: format(calculatedEnd, 'HH:mm')
        });
        setShowEventModal(true);
    };

    const handleStartDateChange = (newDate: string) => {
        setEventForm(prev => {
            const newStart = parse(`${newDate}T${prev.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
            const currentEnd = parse(`${endDateTime.date}T${endDateTime.time}`, "yyyy-MM-dd'T'HH:mm", new Date());
            
            let newEnd = addMinutes(newStart, prev.duration || 0);

            // Ensure end is not before new start
            if (isBefore(newEnd, newStart)) {
                newEnd = addMinutes(newStart, 60); // Default 1 hour duration
                setEventForm(p => ({...p, duration: 60}));
            }

            setEndDateTime({
                date: format(newEnd, 'yyyy-MM-dd'),
                time: format(newEnd, 'HH:mm')
            });

            return {...prev, date: newDate};
        });
    };

    const handleStartTimeChange = (newTime: string) => {
        setEventForm(prev => {
            if (!prev.date) return prev;
            const newStart = parse(`${prev.date}T${newTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
            
            let newEnd = addMinutes(newStart, prev.duration || 0);

            // Ensure end is not before new start
            if (isBefore(newEnd, newStart)) {
                newEnd = addMinutes(newStart, 60); // Default 1 hour duration
                setEventForm(p => ({...p, duration: 60}));
            }

            setEndDateTime({
                date: format(newEnd, 'yyyy-MM-dd'),
                time: format(newEnd, 'HH:mm')
            });

            return {...prev, startTime: newTime};
        });
    };

    const handleEndDateChange = (newDate: string) => {
        // Changing end date recalculates duration
        if (!eventForm.date || !eventForm.startTime || !newDate || !endDateTime.time) return;
        const start = parse(`${eventForm.date}T${eventForm.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
        const end = parse(`${newDate}T${endDateTime.time}`, "yyyy-MM-dd'T'HH:mm", new Date());
        
        const diff = differenceInMinutes(end, start);
        if (diff > 0) setEventForm(prev => ({...prev, duration: diff}));
        setEndDateTime(prev => ({...prev, date: newDate})); // Update local end date state
    };

    const handleEndTimeChange = (newTime: string) => {
        // Changing end time recalculates duration
        if (!eventForm.date || !eventForm.startTime || !endDateTime.date || !newTime) return;
        const start = parse(`${eventForm.date}T${eventForm.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
        const end = parse(`${endDateTime.date}T${newTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
        
        const diff = differenceInMinutes(end, start);
        if (diff > 0) setEventForm(prev => ({...prev, duration: diff}));
        setEndDateTime(prev => ({...prev, time: newTime})); // Update local end time state
    };

    // --- Render Logic ---
    const getWeekDays = (refDate: Date) => {
        const start = new Date(refDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(start.setDate(diff));
        return Array.from({length: 7}, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d;
        });
    };

    const renderDayColumn = (day: Date, isFullWidth = true) => {
        const dateStr = toISODate(day);
        const isToday = dateStr === toISODate(currentTime);
        
        // Filter events using memoized cache for positions
        const dayEvents = events
            .filter(e => {
                const cached = eventPositionsCache.get(e.id);
                return cached?.dateInView === dateStr;
            })
            .map(ev => {
                const cached = eventPositionsCache.get(ev.id)!;
                return { ...ev, top: cached.top, height: cached.height, start: cached.top, end: cached.top + cached.height };
            })
            .sort((a, b) => a.start - b.start || b.duration - a.duration);

        // Calculate layout columns for side-by-side display
        const columns: any[][] = [];
        dayEvents.forEach(ev => {
            let placed = false;
            for (const col of columns) {
                const lastEv = col[col.length - 1];
                if (ev.start >= lastEv.end) {
                    col.push(ev);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([ev]);
            }
        });

        // Flatten back to list with colIndex
        const positionedEvents: any[] = [];
        columns.forEach((col, colIndex) => {
            col.forEach(ev => {
                positionedEvents.push({ ...ev, colIndex, totalCols: columns.length });
            });
        });

        return (
            <div className={`relative h-full ${isFullWidth ? 'flex-1' : 'w-full'} border-r border-slate-100 dark:border-slate-700/50 last:border-r-0 group`}>
                {/* Background Grid */}
                <div className="absolute inset-0 flex flex-col pointer-events-none">
                    {Array.from({ length: HOURS_COUNT }).map((_, i) => (
                        <div key={i} className="border-b border-slate-100 dark:border-slate-700/50 w-full" style={{ height: PIXELS_PER_HOUR }}></div>
                    ))}
                </div>

                {/* Click Targets */}
                <div className="absolute inset-0 z-0">
                    {Array.from({ length: HOURS_COUNT }).map((_, i) => (
                        <div 
                            key={i}
                            onClick={() => handleGridClick(day, START_HOUR + i)}
                            className="absolute w-full cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                            style={{ top: i * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }}
                        ></div>
                    ))}
                </div>

                {/* Events */}
                {positionedEvents.map(ev => {
                    const width = 85 / ev.totalCols;
                    const left = ev.colIndex * width;
                    
                    return (
                        <div
                            key={ev.id}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                // Allow editing ALL events now
                                setIsEditing(true); 
                                setEventForm({...ev}); 
                                setShowEventModal(true); 
                            }}
                            className={`absolute rounded-lg p-2 text-xs shadow-sm cursor-pointer z-10 hover:z-20 hover:shadow-md transition-all flex flex-col overflow-hidden border ${getEventStyle(ev.type)}`}
                            style={{ 
                                top: `${ev.top}px`, 
                                height: `${ev.height}px`, 
                                minHeight: '30px', 
                                width: `${width}%`,
                                left: `${left}%`
                            }}
                        >
                            <div className="font-bold truncate leading-tight flex items-center gap-1">
                                {ev.title}
                            </div>
                            {ev.height > 40 && (
                                <div className="text-[11px] opacity-80 mt-0.5">
                                    <div className="flex items-center gap-1">
                                        <Clock size={11} /> 
                                        {ev.originalDateTime 
                                            ? formatInTimeZone(toZonedTime(ev.originalDateTime!, ev.originalTimezone!), viewTimezone, 'HH:mm')
                                            : ev.startTime
                                        }
                                    </div>
                                    {ev.meetLink && (
                                        <a href={ev.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline truncate">
                                            <Video size={10} /> {ev.meetLink.replace('https://', '').replace('http://', '').split('/')[0]}
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Red Line (Current Time) */}
                {isToday && (
                    <div 
                        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                        style={{ 
                            top: `${((currentTime.getHours() - START_HOUR) * 60 + currentTime.getMinutes()) / 60 * PIXELS_PER_HOUR}px` 
                        }}
                    >
                        <div className="w-full h-[2px] bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]"></div>
                        <div className="absolute -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                )}
            </div>
        );
    };

    // --- Modal Content ---
    const ExpandedModal = () => (
        <div className="fixed inset-0 z-[100] bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
                    <h2 className="text-xl md:text-3xl font-serif font-bold text-slate-800 dark:text-white">Agenda</h2>
                    
                    {/* View Switcher */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        {(['day', 'week', 'month'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setViewMode(m)}
                                className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-bold capitalize transition-all ${viewMode === m ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-orange' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {m === 'day' ? 'Jour' : m === 'week' ? 'Sem.' : 'Mois'}
                            </button>
                        ))}
                    </div>

                    {/* Timezone Selector */}
                    <div className="relative group hidden md:block">
                        <button className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-orange px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <Globe size={16} /> 
                            {viewTimezone.split('/').pop()?.replace(/_/g, ' ')}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
                    <button 
                        onClick={() => setCurrentDate(new Date())} 
                        className="px-3 md:px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs md:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                        aria-label="Aller à aujourd'hui"
                    >
                        Aujourd'hui
                    </button>
                    <div className="flex items-center gap-1 md:gap-2">
                        <button 
                            onClick={() => navigate(-1)} 
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Période précédente"
                        >
                            <ChevronLeft />
                        </button>
                        <span className="text-sm md:text-lg font-bold w-32 md:w-48 text-center capitalize truncate">
                            {viewMode === 'day' ? format(currentDate, 'EEEE d MMMM', { locale: fr }) :
                             viewMode === 'week' ? `Semaine ${format(currentDate, 'w')}` :
                             format(currentDate, 'MMMM yyyy', { locale: fr })}
                        </span>
                        <button 
                            onClick={() => navigate(1)} 
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Période suivante"
                        >
                            <ChevronRight />
                        </button>
                    </div>
                    <button 
                        onClick={() => setIsExpanded(false)} 
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:text-red-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Fermer le mode immersion"
                    >
                        <Minimize2 size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar (Mini Cal + Filters) */}
                <div className="w-64 border-r border-slate-200 dark:border-slate-800 p-6 hidden lg:block overflow-y-auto">
                    <button onClick={() => { setIsEditing(false); setEventForm({ type: 'Meeting', date: toISODate(currentDate), startTime: '09:00', duration: 60, originalTimezone: viewTimezone }); setShowEventModal(true); }} className="w-full py-3 bg-brand-orange text-white rounded-xl shadow-lg shadow-orange-200 dark:shadow-none font-bold mb-8 flex items-center justify-center gap-2 hover:scale-105 transition-transform">
                        <Plus size={20} /> Créer
                    </button>
                    {/* Mini Month View (Simplified) */}
                    <div className="mb-6">
                        <div className="font-bold mb-4 capitalize text-slate-700 dark:text-slate-200">{format(currentDate, 'MMMM yyyy', { locale: fr })}</div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                            {['L','M','M','J','V','S','D'].map(d => <div key={d} className="text-slate-400 font-bold py-1">{d}</div>)}
                            {Array.from({length: 35}).map((_, i) => {
                                const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                                d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) + i);
                                const isSel = toISODate(d) === toISODate(currentDate);
                                return (
                                    <div key={i} onClick={() => setCurrentDate(d)} className={`py-1.5 rounded-full cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${isSel ? 'bg-brand-orange text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {d.getDate()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Calendar Sources */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Mes agendas</div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={visibleSources.local} 
                                    onChange={() => setVisibleSources(prev => ({ ...prev, local: !prev.local }))}
                                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                                />
                                <span className="w-3 h-3 rounded-sm bg-brand-orange flex-shrink-0" />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Marion Web OS</span>
                            </label>
                            {googleCalendarConnected && (
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={visibleSources.google} 
                                        onChange={() => setVisibleSources(prev => ({ ...prev, google: !prev.google }))}
                                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                                    />
                                    <span className="w-3 h-3 rounded-sm bg-blue-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Google Calendar</div>
                                        {googleCalendarEmail && <div className="text-[11px] text-slate-400 truncate">{googleCalendarEmail}</div>}
                                    </div>
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div ref={expandedGridRef} className="flex-1 overflow-y-auto relative no-scrollbar bg-white dark:bg-[#0B0F19] pt-4 pb-20">
                    {viewMode === 'month' ? (
                        <div className="h-full flex flex-col">
                            {/* Day name headers */}
                            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
                                {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(d => (
                                    <div key={d} className="text-center py-2 text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            {/* Month grid */}
                            <div className="flex-1 grid grid-cols-7 grid-rows-5">
                                {Array.from({length: 35}).map((_, i) => {
                                    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                                    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) + i);
                                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                                    const isToday = toISODate(d) === toISODate(currentTime);
                                    const dayEvents = events.filter(e => {
                                        const cached = eventPositionsCache.get(e.id);
                                        return (cached?.dateInView || e.date) === toISODate(d);
                                    });
                                    const visibleEvents = dayEvents.slice(0, 3);
                                    const moreCount = dayEvents.length - 3;
                                    return (
                                        <div 
                                            key={i} 
                                            onClick={() => handleGridClick(d, 9)}
                                            className={`border-b border-r border-slate-200 dark:border-slate-700 p-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors min-h-[100px] ${
                                                !isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-transparent'
                                            } ${i % 7 === 0 ? 'border-l' : ''} ${i < 7 ? 'border-t' : ''}`}
                                        >
                                            <div className={`text-xs font-bold mb-1 flex justify-end ${!isCurrentMonth ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {isToday ? (
                                                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-brand-orange text-white text-xs font-bold">
                                                        {d.getDate()}
                                                    </span>
                                                ) : (
                                                    <span className="w-7 h-7 flex items-center justify-center">
                                                        {d.getDate()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-0.5">
                                                {visibleEvents.map(ev => (
                                                    <div 
                                                        key={ev.id} 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setIsEditing(true); 
                                                            setEventForm({...ev}); 
                                                            setShowEventModal(true); 
                                                        }}
                                                        className={`flex items-center gap-1 text-[11px] leading-tight truncate px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                                                            ev.duration && ev.duration >= 1440
                                                                ? `${getEventChipStyle(ev.type)} rounded-md font-medium`
                                                                : 'text-slate-700 dark:text-slate-200'
                                                        }`}
                                                    >
                                                        {(!ev.duration || ev.duration < 1440) && (
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getEventDotColor(ev.type)}`} />
                                                        )}
                                                        <span className="truncate">
                                                            {ev.startTime && (!ev.duration || ev.duration < 1440) ? (
                                                                <><span className="font-medium">{ev.startTime.replace(/^0/, '')}</span> {ev.title}</>
                                                            ) : ev.title}
                                                        </span>
                                                    </div>
                                                ))}
                                                {moreCount > 0 && (
                                                    <div 
                                                        className="text-[11px] font-medium text-brand-orange hover:underline cursor-pointer px-1.5"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCurrentDate(d);
                                                            setViewMode('day');
                                                        }}
                                                    >
                                                        +{moreCount} autre{moreCount > 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-full">
                            {/* Time Axis */}
                            <div className="w-16 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 sticky left-0 z-20">
                                {Array.from({ length: HOURS_COUNT }).map((_, i) => (
                                    <div key={i} className="relative border-b border-transparent" style={{ height: PIXELS_PER_HOUR }}>
                                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-400 bg-white/80 dark:bg-slate-800 px-1 rounded">
                                            {`${START_HOUR + i}:00`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Columns */}
                            <div className="flex-1 flex">
                                {viewMode === 'day' ? renderDayColumn(currentDate) : getWeekDays(currentDate).map(d => {
                                    const isDayToday = toISODate(d) === toISODate(currentTime);
                                    return (
                                        <div key={d.toISOString()} className="flex-1 flex flex-col min-w-[150px]">
                                            <div className={`text-center py-2 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-900/95 z-10 backdrop-blur-sm`}>
                                                <div className={`text-[11px] uppercase font-bold tracking-wider ${isDayToday ? 'text-brand-orange' : 'text-slate-500 dark:text-slate-400'}`}>{format(d, 'EEE', { locale: fr })}</div>
                                                <div className="flex justify-center mt-0.5">
                                                    {isDayToday ? (
                                                        <span className="w-9 h-9 flex items-center justify-center rounded-full bg-brand-orange text-white text-lg font-serif font-bold">
                                                            {d.getDate()}
                                                        </span>
                                                    ) : (
                                                        <span className="w-9 h-9 flex items-center justify-center text-xl font-serif font-bold text-slate-800 dark:text-white">
                                                            {d.getDate()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 relative">
                                                {renderDayColumn(d, false)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // --- Widget View (Compact) ---
    return (
        <>
            <div className="flex flex-col h-[350px] md:h-[500px] w-full animate-in fade-in slide-in-from-left duration-500">
                {/* Reconnect banner */}
                {!googleCalendarConnected && (
                    <div className="mx-1 mb-2 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs">
                        <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                        <span className="text-amber-700 dark:text-amber-300 flex-1">Google Calendar déconnecté</span>
                        <button
                            onClick={handleReconnect}
                            className="px-2.5 py-1 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors text-[11px]"
                        >
                            Reconnecter
                        </button>
                    </div>
                )}
                {/* Widget Header : date à gauche, boutons alignés à droite sur une seule ligne */}
                <div className="flex justify-between items-center mb-3 px-1">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => navigate(-1)} 
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Jour précédent"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="text-center">
                            <div className="text-xl md:text-2xl font-serif font-bold text-slate-800 dark:text-white capitalize leading-none">
                                {format(currentDate, 'EEEE d', { locale: fr })}
                            </div>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                {format(currentDate, 'MMMM', { locale: fr })}
                            </div>
                        </div>
                        <button 
                            onClick={() => navigate(1)} 
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Jour suivant"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Google Calendar Sync Indicator */}
                        {googleCalendarConnected ? (
                            <div 
                                className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-bold"
                                title={`Synchronisé avec ${googleCalendarEmail || 'Google Calendar'}`}
                            >
                                {isSyncing ? (
                                    <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                )}
                                <span className="hidden sm:inline">Sync</span>
                            </div>
                        ) : (
                            <button 
                                onClick={handleReconnect}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                title="Cliquez pour reconnecter Google Calendar"
                            >
                                <AlertCircle size={12} />
                                <span className="hidden sm:inline">Reconnecter</span>
                            </button>
                        )}
                        
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-brand-orange transition-colors"
                            title="Aujourd'hui"
                            aria-label="Aller à aujourd'hui"
                        >
                            <CalIcon size={18} />
                        </button>
                        <button
                            onClick={() => setShowLocationModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-brand-orange transition-colors"
                            title="Changer de ville"
                        >
                            <MapPin size={18} />
                            <span className="text-sm font-bold capitalize">
                                {customCity || localTimezone.split('/').pop()?.replace(/_/g, ' ')}
                            </span>
                            <span className="text-sm text-slate-400 border-l border-slate-300 dark:border-slate-600 pl-2">
                                {formatInTimeZone(currentTime, localTimezone, 'HH:mm')}
                            </span>
                        </button>
                        <button 
                            onClick={() => setIsExpanded(true)} 
                            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-brand-orange transition-colors" 
                            title="Agrandir"
                            aria-label="Agrandir l'agenda"
                        >
                            <Maximize2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Widget Content (Simple Timeline) */}
                <div className="flex-1 bg-white/60 dark:bg-slate-800/40 backdrop-blur-md rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative flex flex-col overflow-hidden">
                    <div ref={gridContainerRef} className="flex-1 overflow-y-auto no-scrollbar relative pt-4 pb-20">
                        <div className="flex relative" style={{ height: HOURS_COUNT * PIXELS_PER_HOUR }}>
                            <div className="w-14 flex-shrink-0 border-r border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/10 z-10 sticky left-0">
                                {Array.from({ length: HOURS_COUNT }).map((_, i) => (
                                    <div key={i} className="relative" style={{ height: PIXELS_PER_HOUR }}>
                                        <span className="absolute -top-2 right-3 text-[10px] font-bold text-slate-400 tabular-nums">{`${START_HOUR + i}:00`}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 relative">
                                {renderDayColumn(currentDate)}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setIsEditing(false); setEventForm({ date: toISODate(currentDate), startTime: '09:00', duration: 60, originalTimezone: localTimezone, type: 'Meeting' }); setShowEventModal(true); }}
                        className="absolute bottom-4 right-4 w-12 h-12 bg-brand-orange text-white rounded-full shadow-lg shadow-orange-200/50 dark:shadow-none flex items-center justify-center hover:scale-110 transition-transform z-20"
                    >
                        <Plus size={24} />
                    </button>
                </div>
            </div>

            {/* Immersion Mode Overlay */}
            {isExpanded && createPortal(<ExpandedModal />, document.body)}

            {/* Event Modal (Shared) */}
            <Modal isOpen={showEventModal} onClose={() => setShowEventModal(false)} title={isEditing ? "Modifier" : "Nouvel Événement"}>
                <div className="space-y-6">
                    {formError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16}/>{formError}</div>}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Titre</label>
                                            <input 
                                                autoFocus 
                                                value={eventForm.title || ''} 
                                                onChange={e => setEventForm({...eventForm, title: e.target.value})} 
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !isEditing) { // Only create if not editing an existing event
                                                        e.preventDefault(); // Prevent default behavior (e.g., form submission)
                                                        handleSaveEvent();
                                                    }
                                                }}
                                                placeholder="Ex: Brief Client..." 
                                                className="w-full text-xl font-serif border-b-2 border-slate-200 bg-transparent py-2 focus:border-brand-orange focus:outline-none dark:text-white" 
                                            />
                                        </div>
                                        
                                        {/* Lieu / Visio (Moved for prominence) */}
                                        <div>
                                             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Lieu / Visio</label>
                                             <div className="flex flex-col gap-2">
                                                {!eventForm.meetLink ? (
                                                    <button 
                                                        onClick={generateMeet}
                                                        disabled={isGeneratingMeet}
                                                        className="flex items-center justify-center gap-2 w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                                                    >
                                                        {isGeneratingMeet ? (
                                                            <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Création en cours...</>
                                                        ) : (
                                                            <><Video size={16} /> Générer un lien Google Meet</>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                                                        <div className="p-1.5 bg-blue-100 dark:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-300">
                                                            <Video size={16} />
                                                        </div>
                                                        <a href={eventForm.meetLink} target="_blank" rel="noreferrer" className="flex-1 text-xs font-bold text-blue-600 dark:text-blue-400 truncate hover:underline">
                                                            {eventForm.meetLink}
                                                        </a>
                                                        <button 
                                                            onClick={() => navigator.clipboard.writeText(eventForm.meetLink || '')}
                                                            className="p-1.5 text-blue-400 hover:text-blue-600 transition-colors"
                                                            title="Copier"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => setEventForm({...eventForm, meetLink: undefined})}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Google Calendar Style Date/Time Selection */}
                                        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Début</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="date" 
                                                        value={eventForm.date} 
                                                        onChange={e => handleStartDateChange(e.target.value)} 
                                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3 outline-none text-sm dark:text-white" 
                                                    />
                                                    <input 
                                                        type="time" 
                                                        value={eventForm.startTime} 
                                                        onChange={e => handleStartTimeChange(e.target.value)} 
                                                        className="w-24 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3 outline-none text-sm dark:text-white" 
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="pb-4 text-slate-400">
                                                <ArrowRight size={20} />
                                            </div>
                    
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fin</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="date" 
                                                        value={endDateTime.date} 
                                                        onChange={e => handleEndDateChange(e.target.value)} 
                                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3 outline-none text-sm dark:text-white" 
                                                    />
                                                    <input 
                                                        type="time" 
                                                        value={endDateTime.time} 
                                                        onChange={e => handleEndTimeChange(e.target.value)} 
                                                        className="w-24 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3 outline-none text-sm dark:text-white" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                    
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fuseau Horaire (Original)</label>
                                                                <div className="relative">
                                                                    <input 
                                                                        ref={timezoneInputRef}
                                                                        value={searchTimezoneQuery || (eventForm.originalTimezone ? `${eventForm.originalTimezone.split('/').pop()?.replace(/_/g, ' ')} - ${eventForm.originalTimezone.split('/')[0]}` : '')}
                                                                        onChange={e => { setSearchTimezoneQuery(e.target.value); setShowTimezoneDropdown(true); }}
                                                                        onFocus={() => { setSearchTimezoneQuery(''); setShowTimezoneDropdown(true); }}
                                                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none dark:text-white"
                                                                    />
                                                                    {showTimezoneDropdown && (
                                                                        <div ref={timezoneDropdownRef} className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                                                            {filteredTimezones.map(tz => (
                                                                                <div key={tz.value} onClick={() => { setEventForm({...eventForm, originalTimezone: tz.value}); setShowTimezoneDropdown(false); setSearchTimezoneQuery(''); }} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-white">
                                                                                    {tz.label}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                        
                                                            <div>
                                                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notes / Description</label>
                                                                 <textarea 
                                                                    value={eventForm.description || ''}
                                                                    onChange={e => setEventForm({...eventForm, description: e.target.value})}
                                                                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange h-24 resize-none dark:text-white"
                                                                    placeholder="Détails de l'événement..."
                                                                 />
                                                            </div>                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Type</label>
                        <div className="flex gap-2">
                            {['Meeting', 'Deadline', 'Focus', 'Personal'].map(t => (
                                <EventTypeBadge key={t} type={t} selected={eventForm.type === t} onClick={() => setEventForm({...eventForm, type: t as any})} />
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                        {isEditing && <button onClick={() => { onDeleteEvent(eventForm.id!); setShowEventModal(false); }} className="text-red-500 font-bold text-sm">Supprimer</button>}
                        <button onClick={handleSaveEvent} className="bg-brand-orange text-white px-6 py-2 rounded-full font-bold ml-auto">{isEditing ? 'Sauvegarder' : 'Créer'}</button>
                    </div>
                </div>
            </Modal>

            {/* Location Selector Modal */}
            <Modal isOpen={showLocationModal} onClose={() => setShowLocationModal(false)} title="Sélectionner une ville" width="max-w-md">
                <div className="space-y-4">
                    {/* Search Bar at TOP */}
                    <div className="relative">
                        <MapIcon className="absolute left-3 top-3.5 text-slate-400" size={16} />
                        <input 
                            placeholder="Rechercher une ville..."
                            value={locationSearchQuery}
                            onChange={(e) => setLocationSearchQuery(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900 border-0 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                            autoFocus
                        />
                        {locationSearchQuery && (
                            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                {filteredLocationTimezones.length > 0 ? (
                                    filteredLocationTimezones.map(tz => {
                                        const isFavorite = userFavoriteCities.some(f => f.tz === tz.value);
                                        return (
                                            <div 
                                                key={tz.value} 
                                                className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-white border-b border-slate-50 dark:border-slate-700 last:border-0"
                                            >
                                                <div 
                                                    className="flex-1"
                                                    onClick={() => {
                                                        setCustomCity(tz.city);
                                                        setLocalTimezone(tz.value);
                                                        setViewTimezone(tz.value);
                                                        setShowLocationModal(false);
                                                        setLocationSearchQuery('');
                                                    }}
                                                >
                                                    <span className="font-medium">{tz.city}</span>
                                                    <span className="text-slate-400 ml-2 text-xs">{tz.region}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400 tabular-nums">{formatInTimeZone(currentTime, tz.value, 'HH:mm')}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isFavorite) {
                                                                setUserFavoriteCities(prev => prev.filter(f => f.tz !== tz.value));
                                                            } else {
                                                                const flag = tz.region === 'Europe' ? '🇪🇺' : tz.region === 'America' ? '🌎' : tz.region === 'Asia' ? '🌏' : tz.region === 'Africa' ? '🌍' : tz.region === 'Australia' ? '🇦🇺' : '🌐';
                                                                setUserFavoriteCities(prev => [...prev, { name: tz.city, tz: tz.value, country: flag }]);
                                                            }
                                                        }}
                                                        className={`p-1.5 rounded-full transition-all ${isFavorite ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}
                                                        title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                                    >
                                                        <Star size={14} className={isFavorite ? 'fill-amber-500' : ''} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-sm text-slate-400 text-center">Aucun résultat pour "{locationSearchQuery}"</div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Favorite Cities */}
                    {userFavoriteCities.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Star size={14} className="text-amber-500 fill-amber-500" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mes Favoris</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {userFavoriteCities.map(city => (
                                    <div
                                        key={city.tz}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                            customCity === city.name
                                            ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 dark:from-orange-500/30 dark:to-amber-500/30 border-brand-orange shadow-sm ring-1 ring-brand-orange/30' 
                                            : 'bg-gradient-to-r from-amber-50/30 to-orange-50/30 dark:from-slate-800 dark:to-slate-800 border-amber-200/50 dark:border-slate-700 hover:border-brand-orange'
                                        }`}
                                    >
                                        <button
                                            onClick={() => {
                                                setCustomCity(city.name);
                                                setLocalTimezone(city.tz);
                                                setViewTimezone(city.tz);
                                                setShowLocationModal(false);
                                            }}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            <span className="text-lg">{city.country}</span>
                                            <span className="font-bold text-sm dark:text-white">{city.name}</span>
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 tabular-nums bg-white/60 dark:bg-slate-700 px-2 py-1 rounded-full">
                                                {formatInTimeZone(currentTime, city.tz, 'HH:mm')}
                                            </span>
                                            <button
                                                onClick={() => setUserFavoriteCities(prev => prev.filter(f => f.tz !== city.tz))}
                                                className="p-1.5 text-amber-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                                title="Retirer des favoris"
                                            >
                                                <Star size={14} className="fill-amber-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Globe size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suggestions</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                            {COMMON_CITIES.filter(c => !userFavoriteCities.some(f => f.tz === c.tz)).map(city => (
                                <div
                                    key={city.name}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                        customCity === city.name
                                        ? 'bg-orange-500/15 dark:bg-orange-500/25 border-brand-orange ring-1 ring-brand-orange/30' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <button
                                        onClick={() => {
                                            setCustomCity(city.name);
                                            setLocalTimezone(city.tz);
                                            setViewTimezone(city.tz);
                                            setShowLocationModal(false);
                                        }}
                                        className="flex items-center gap-3 flex-1 text-left"
                                    >
                                        <span className="text-lg">{city.country}</span>
                                        <span className="font-bold text-sm dark:text-white">{city.name}</span>
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 tabular-nums">
                                            {formatInTimeZone(currentTime, city.tz, 'HH:mm')}
                                        </span>
                                        <button
                                            onClick={() => setUserFavoriteCities(prev => [...prev, { name: city.name, tz: city.tz, country: city.country }])}
                                            className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-all"
                                            title="Ajouter aux favoris"
                                        >
                                            <Star size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export const Agenda = React.memo(AgendaInner);