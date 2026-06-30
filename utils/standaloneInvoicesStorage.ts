import type { Invoice } from '../types';

const STORAGE_KEY = 'marion_standalone_invoices_v1';

export function loadStandaloneInvoices(): Invoice[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
    } catch {
        return [];
    }
}

function persist(list: Invoice[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        /* quota / private mode */
    }
}

export function upsertStandaloneInvoice(invoice: Invoice): void {
    const list = loadStandaloneInvoices();
    const idx = list.findIndex((i) => i.id === invoice.id);
    if (idx >= 0) list[idx] = invoice;
    else list.push(invoice);
    persist(list);
}

export function removeStandaloneInvoice(id: string): void {
    const list = loadStandaloneInvoices().filter((i) => i.id !== id);
    persist(list);
}
