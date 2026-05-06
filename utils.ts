/**
 * Format a number with apostrophes as thousand separators (Swiss/French style)
 * Example: formatCurrency(20000) -> "20'000.00"
 * Example: formatCurrency(20000, 'CHF') -> "20'000.00 CHF"
 * Example: formatCurrency(20000, 0) -> "20'000"
 */

import type { Invoice } from './types';
export function formatCurrency(amount: number | string, decimalsOrCurrency: number | string = 2): string {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    
    // If second arg is a string, it's a currency symbol — use default 2 decimals
    const isCurrency = typeof decimalsOrCurrency === 'string';
    const decimals = isCurrency ? 2 : decimalsOrCurrency;
    const currency = isCurrency ? decimalsOrCurrency : null;

    const fixed = num.toFixed(decimals);
    const [integerPart, decimalPart] = fixed.split('.');
    
    // Add apostrophes as thousand separators
    const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    
    const result = decimalPart ? `${formatted}.${decimalPart}` : formatted;
    return currency ? `${result} ${currency}` : result;
}

/**
 * Format currency with symbol
 * Example: formatCurrencyWithSymbol(20000, 'CHF') -> "20'000.00 CHF"
 */
export function formatCurrencyWithSymbol(amount: number | string, currency: string = 'CHF', decimals: number = 2): string {
    return `${formatCurrency(amount, decimals)} ${currency}`;
}

// ---------------------------------------------------------------------------
// Factures — totaux robustes pour les KPI / tableaux
// ---------------------------------------------------------------------------

/** Total des lignes (quantité × prix unitaire). */
export function invoiceItemsSubtotal(inv: Pick<Invoice, 'items'>): number {
    if (!inv.items?.length) return 0;
    return inv.items.reduce((sum, it) => {
        const q = Number(it.quantity);
        const p = Number(it.price);
        const qn = Number.isFinite(q) ? q : 0;
        const pn = Number.isFinite(p) ? p : 0;
        return sum + qn * pn;
    }, 0);
}

/**
 * Montant utilisé dans les dashboards : `invoice.amount` s'il est défini (> 0),
 * sinon recalcul depuis les lignes (anciennes données ou amount non synchro après édition).
 */
export function invoiceEffectiveAmount(inv: Invoice): number {
    const stored = Number(inv.amount);
    const storedOk = Number.isFinite(stored) && stored > 0;
    const fromLines = invoiceItemsSubtotal(inv);
    if (storedOk) return stored;
    if (fromLines > 0) return fromLines;
    return Number.isFinite(stored) ? stored : 0;
}
