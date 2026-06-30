/**
 * Invoice Numbering Service
 *
 * Wraps the backend atomic counter API (`/api/v1/invoices/next-number`).
 *
 * - `requestNextInvoiceNumber()` : alloue et CONSOMME un numéro (incrémente).
 * - `previewNextInvoiceNumber()` : lit le prochain numéro SANS incrémenter.
 *
 * En cas d'échec réseau, on tombe sur un format `F{YYYY}-DRAFT-{timestamp}` qui
 * sera reconnu côté UI comme "non verrouillé" — empêche les collisions tout en
 * laissant l'utilisateur travailler hors-ligne.
 */

import { apiFetch } from './api';

export interface NextInvoiceNumberResponse {
    number: string;
    year: number;
    sequence: number;
    format: string;
}

interface RequestOptions {
    year?: number;
    /** Lecture seule (ne consomme pas le compteur). */
    preview?: boolean;
}

async function callBackend(opts: RequestOptions): Promise<NextInvoiceNumberResponse | null> {
    try {
        const res = await apiFetch('/api/v1/invoices/next-number', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                year: opts.year,
                preview: !!opts.preview,
            }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as NextInvoiceNumberResponse;
        if (!data || !data.number) return null;
        return data;
    } catch {
        return null;
    }
}

export async function requestNextInvoiceNumber(year?: number): Promise<string> {
    const res = await callBackend({ year, preview: false });
    if (res) return res.number;
    // Fallback hors-ligne — pas séquentiel mais marqué DRAFT pour qu'on le
    // retire à la prochaine ouverture/save online.
    const y = year || new Date().getFullYear();
    return `F${y}-DRAFT-${Date.now().toString().slice(-6)}`;
}

export async function previewNextInvoiceNumber(year?: number): Promise<string | null> {
    const res = await callBackend({ year, preview: true });
    return res ? res.number : null;
}

/** Détecte un numéro de secours (fallback offline) — doit être remplacé à la 1re save online. */
export function isDraftFallbackNumber(num: string): boolean {
    return /^F\d{4}-DRAFT-\d+$/.test(num);
}
