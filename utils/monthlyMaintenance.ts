/**
 * Rappel mensuel maintenance (le 25) — helpers purs.
 */

export const MONTHLY_MAINTENANCE_STORAGE_KEY = 'marion_monthly_maintenance_v1';

export interface MonthlyMaintenanceState {
    /** Interrupteur activé par Marion dans le dossier Maintenance. */
    enabled: boolean;
    /** Mois validé globalement, format YYYY-MM (ex. 2026-08). */
    lastOkMonth: string | null;
    /** Clients cochés « Fait » par mois. */
    doneByMonth: Record<string, string[]>;
}

export const DEFAULT_MONTHLY_MAINTENANCE: MonthlyMaintenanceState = {
    enabled: false,
    lastOkMonth: null,
    doneByMonth: {},
};

export function monthKeyFromDate(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/** Fenêtre du rappel : à partir du 25 jusqu’à la fin du mois. */
export function isMaintenanceReminderWindow(date: Date = new Date()): boolean {
    return date.getDate() >= 25;
}

export function shouldShowMonthlyMaintenanceBanner(
    state: MonthlyMaintenanceState,
    date: Date = new Date(),
): boolean {
    if (!state.enabled) return false;
    if (!isMaintenanceReminderWindow(date)) return false;
    return state.lastOkMonth !== monthKeyFromDate(date);
}

export function loadMonthlyMaintenanceState(): MonthlyMaintenanceState {
    try {
        const raw = localStorage.getItem(MONTHLY_MAINTENANCE_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_MONTHLY_MAINTENANCE };
        const parsed = JSON.parse(raw) as Partial<MonthlyMaintenanceState>;
        return {
            enabled: Boolean(parsed.enabled),
            lastOkMonth: typeof parsed.lastOkMonth === 'string' ? parsed.lastOkMonth : null,
            doneByMonth:
                parsed.doneByMonth && typeof parsed.doneByMonth === 'object'
                    ? parsed.doneByMonth
                    : {},
        };
    } catch {
        return { ...DEFAULT_MONTHLY_MAINTENANCE };
    }
}

export function persistMonthlyMaintenanceState(state: MonthlyMaintenanceState): void {
    localStorage.setItem(MONTHLY_MAINTENANCE_STORAGE_KEY, JSON.stringify(state));
}

export function formatMonthLabel(monthKey: string, locale = 'fr-CH'): string {
    const [y, m] = monthKey.split('-').map(Number);
    if (!y || !m) return monthKey;
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function formatLastOkLabel(lastOkMonth: string | null, locale = 'fr-CH'): string {
    if (!lastOkMonth) return 'Jamais';
    return formatMonthLabel(lastOkMonth, locale);
}
