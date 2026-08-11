import { describe, expect, it } from 'vitest';
import {
    DEFAULT_MONTHLY_MAINTENANCE,
    isMaintenanceReminderWindow,
    monthKeyFromDate,
    shouldShowMonthlyMaintenanceBanner,
} from '../../utils/monthlyMaintenance';

describe('monthlyMaintenance', () => {
    it('monthKeyFromDate formats YYYY-MM', () => {
        expect(monthKeyFromDate(new Date(2026, 7, 25))).toBe('2026-08');
    });

    it('reminder window starts on the 25th', () => {
        expect(isMaintenanceReminderWindow(new Date(2026, 7, 24))).toBe(false);
        expect(isMaintenanceReminderWindow(new Date(2026, 7, 25))).toBe(true);
        expect(isMaintenanceReminderWindow(new Date(2026, 7, 31))).toBe(true);
    });

    it('banner only when enabled, in window, and month not OK', () => {
        const base = { ...DEFAULT_MONTHLY_MAINTENANCE, enabled: true };
        const day25 = new Date(2026, 7, 25);
        const day10 = new Date(2026, 7, 10);

        expect(shouldShowMonthlyMaintenanceBanner(base, day25)).toBe(true);
        expect(shouldShowMonthlyMaintenanceBanner(base, day10)).toBe(false);
        expect(
            shouldShowMonthlyMaintenanceBanner({ ...base, lastOkMonth: '2026-08' }, day25),
        ).toBe(false);
        expect(
            shouldShowMonthlyMaintenanceBanner({ ...base, enabled: false }, day25),
        ).toBe(false);
    });
});
