/**
 * Store — rappel mensuel maintenance (25 du mois).
 */

import { create } from 'zustand';
import {
    MonthlyMaintenanceState,
    loadMonthlyMaintenanceState,
    persistMonthlyMaintenanceState,
    monthKeyFromDate,
} from '../utils/monthlyMaintenance';

interface MonthlyMaintenanceStore extends MonthlyMaintenanceState {
    setEnabled: (enabled: boolean) => void;
    toggleClientDone: (clientId: string, monthKey?: string) => void;
    setClientDone: (clientId: string, done: boolean, monthKey?: string) => void;
    completeMonth: (monthKey?: string) => void;
    isClientDone: (clientId: string, monthKey?: string) => boolean;
    doneIdsForMonth: (monthKey?: string) => string[];
}

function commit(partial: Partial<MonthlyMaintenanceState>, get: () => MonthlyMaintenanceStore) {
    const next = { ...get(), ...partial };
    const state: MonthlyMaintenanceState = {
        enabled: next.enabled,
        lastOkMonth: next.lastOkMonth,
        doneByMonth: next.doneByMonth,
    };
    persistMonthlyMaintenanceState(state);
    return state;
}

export const useMonthlyMaintenanceStore = create<MonthlyMaintenanceStore>((set, get) => ({
    ...loadMonthlyMaintenanceState(),

    setEnabled: (enabled) => {
        set(commit({ enabled }, get));
    },

    toggleClientDone: (clientId, monthKey = monthKeyFromDate()) => {
        const { doneByMonth } = get();
        const current = new Set(doneByMonth[monthKey] || []);
        if (current.has(clientId)) current.delete(clientId);
        else current.add(clientId);
        set(
            commit(
                {
                    doneByMonth: {
                        ...doneByMonth,
                        [monthKey]: [...current],
                    },
                },
                get,
            ),
        );
    },

    setClientDone: (clientId, done, monthKey = monthKeyFromDate()) => {
        const { doneByMonth } = get();
        const current = new Set(doneByMonth[monthKey] || []);
        if (done) current.add(clientId);
        else current.delete(clientId);
        set(
            commit(
                {
                    doneByMonth: {
                        ...doneByMonth,
                        [monthKey]: [...current],
                    },
                },
                get,
            ),
        );
    },

    completeMonth: (monthKey = monthKeyFromDate()) => {
        set(commit({ lastOkMonth: monthKey }, get));
    },

    isClientDone: (clientId, monthKey = monthKeyFromDate()) => {
        return (get().doneByMonth[monthKey] || []).includes(clientId);
    },

    doneIdsForMonth: (monthKey = monthKeyFromDate()) => {
        return get().doneByMonth[monthKey] || [];
    },
}));
