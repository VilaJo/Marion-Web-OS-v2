/**
 * invoiceEngine — moteur de calcul et migration de factures (Swiss-grade).
 *
 * Centralise toute la logique métier des factures qui était auparavant éparpillée
 * dans InvoiceBuilder, FinanceDashboard, et utils.ts (`invoiceEffectiveAmount`,
 * `calculateVAT`, etc.).
 *
 * Règles de calcul:
 *   - Si une ligne possède `vatRate` (>= 0), elle est considérée en mode "HT" :
 *       price = prix unitaire HT, vat = quantity * price * (rate/100).
 *   - Si une ligne n'a pas de `vatRate` (legacy), elle est considérée TTC sans
 *       TVA ventilée : netHt = total, vat = 0, rate = 0 (compatibilité totale).
 *   - Les arrondis sont effectués au centime (2 décimales) pour chaque taux.
 *
 * Cycle de vie (statuts) :
 *   Draft → (issue) → Sent/Pending → (paiement partiel) → Partial → (paiement total) → Paid
 *                                  → (annulation) → Voided
 *   Tout passage hors Draft verrouille `numberLocked = true`.
 *
 * Soft archive (CO art. 958f, 10 ans) :
 *   `voidInvoice` ne supprime jamais : il marque `status = 'Voided'` + `voidedAt`
 *   et ajoute une entrée d'audit. Seules les `Draft` non émises peuvent être
 *   réellement supprimées via `canHardDelete`.
 */

import type {
    Invoice,
    InvoiceItem,
    InvoiceAuditEntry,
    InvoiceStatus,
    SwissVatRate,
    VatBreakdownEntry,
} from '../types';

const ROUND = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Calcul totaux (HT / TVA / TTC) avec ventilation par taux
// ---------------------------------------------------------------------------

export interface InvoiceTotals {
    subtotalHt: number;
    totalVat: number;
    totalTtc: number;
    vatBreakdown: VatBreakdownEntry[];
    /** true si au moins une ligne contient un vatRate explicite. */
    hasExplicitVat: boolean;
}

/**
 * Calcule les totaux d'une facture à partir de ses lignes.
 *
 * Pour les lignes legacy (sans `vatRate`), le total est considéré comme déjà TTC :
 *   subtotalHt = total, vat = 0, ttc = total. La ventilation est vide.
 *
 * Pour les lignes avec `vatRate` :
 *   - price = HT, vat = price * quantity * (rate/100)
 *   - Les lignes `vatExempt` contribuent à netHt avec rate = 0.
 */
export function computeInvoiceTotals(items: InvoiceItem[]): InvoiceTotals {
    const acc = new Map<number, { netHt: number; vat: number }>();
    let totalHt = 0;
    let totalVat = 0;
    let hasExplicitVat = false;

    for (const it of items) {
        const q = Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 0;
        const p = Number.isFinite(Number(it.price)) ? Number(it.price) : 0;
        const lineNet = q * p;

        if (typeof it.vatRate === 'number') {
            hasExplicitVat = true;
            const rate = it.vatExempt ? 0 : it.vatRate;
            const lineVat = lineNet * (rate / 100);
            totalHt += lineNet;
            totalVat += lineVat;
            const cur = acc.get(rate) || { netHt: 0, vat: 0 };
            acc.set(rate, { netHt: cur.netHt + lineNet, vat: cur.vat + lineVat });
        } else {
            // Legacy : montant déjà TTC, pas de ventilation.
            totalHt += lineNet;
        }
    }

    const vatBreakdown: VatBreakdownEntry[] = Array.from(acc.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([rate, v]) => ({
            rate: rate as SwissVatRate,
            netHt: ROUND(v.netHt),
            vat: ROUND(v.vat),
        }));

    return {
        subtotalHt: ROUND(totalHt),
        totalVat: ROUND(totalVat),
        totalTtc: ROUND(totalHt + totalVat),
        vatBreakdown,
        hasExplicitVat,
    };
}

/** Applique les totaux calculés à une facture (mutation immutable). */
export function withComputedTotals(inv: Invoice): Invoice {
    const totals = computeInvoiceTotals(inv.items || []);
    return {
        ...inv,
        subtotalHt: totals.subtotalHt,
        totalVat: totals.totalVat,
        totalTtc: totals.totalTtc,
        vatBreakdown: totals.vatBreakdown,
        // `amount` reste = TTC pour compat (KPIs lisent encore `amount`)
        amount: totals.totalTtc,
    };
}

// ---------------------------------------------------------------------------
// Statut effectif (calcule "Overdue" à la volée, sans le persister)
// ---------------------------------------------------------------------------

/**
 * Statut affiché à l'utilisateur — calcule Overdue dynamiquement à partir de
 * `status` + `dueDate`. Le statut persisté reste Sent/Pending ; Overdue est
 * un état dérivé qui n'est jamais écrit en base (pour éviter le drift).
 */
export function effectiveStatus(inv: Invoice, now: Date = new Date()): InvoiceStatus {
    if (inv.status === 'Voided' || inv.status === 'Archived') return inv.status;
    if (inv.status === 'Paid' || inv.status === 'Draft') return inv.status;
    if (!inv.dueDate) return inv.status;
    const due = new Date(inv.dueDate);
    if (Number.isNaN(due.getTime())) return inv.status;
    if (due < now) return 'Overdue';
    return inv.status;
}

/** True si la facture est exclue des KPIs (annulée/archivée). */
export function isArchivedStatus(s: InvoiceStatus): boolean {
    return s === 'Voided' || s === 'Archived';
}

// ---------------------------------------------------------------------------
// Soft archive / hard delete
// ---------------------------------------------------------------------------

/** Seules les factures `Draft` jamais émises peuvent être supprimées physiquement. */
export function canHardDelete(inv: Invoice): boolean {
    return inv.status === 'Draft' && !inv.numberLocked;
}

/**
 * Marque une facture comme annulée (soft delete) — conserve toutes ses données
 * pour conformité légale (CO art. 958f, 10 ans).
 */
export function voidInvoice(inv: Invoice, reason?: string, actor = 'Marion'): Invoice {
    return appendAudit(
        {
            ...inv,
            status: 'Voided',
            voidedAt: new Date().toISOString(),
            voidReason: reason,
        },
        { action: 'void', actor, note: reason },
    );
}

/** Restaure une facture annulée vers son statut précédent (par défaut `Sent`). */
export function restoreInvoice(inv: Invoice, fallback: InvoiceStatus = 'Sent', actor = 'Marion'): Invoice {
    if (inv.status !== 'Voided' && inv.status !== 'Archived') return inv;
    return appendAudit(
        {
            ...inv,
            status: fallback,
            voidedAt: undefined,
            archivedAt: undefined,
            voidReason: undefined,
        },
        { action: 'restore', actor },
    );
}

/**
 * Verrouille le numéro de facture (passe de Draft à Sent + numberLocked = true).
 * Appelé lorsqu'on émet officiellement la facture.
 */
export function issueInvoice(inv: Invoice, actor = 'Marion'): Invoice {
    if (inv.status !== 'Draft') return inv;
    return appendAudit(
        {
            ...inv,
            status: 'Sent',
            numberLocked: true,
            issuedAt: inv.issuedAt || new Date().toISOString(),
        },
        { action: 'issue', actor, note: `Facture ${inv.number} émise` },
    );
}

// ---------------------------------------------------------------------------
// Audit log (append-only)
// ---------------------------------------------------------------------------

export function appendAudit(
    inv: Invoice,
    entry: Omit<InvoiceAuditEntry, 'at'> & { at?: string },
): Invoice {
    const history = [
        ...(inv.history || []),
        { at: entry.at || new Date().toISOString(), actor: entry.actor, action: entry.action, note: entry.note },
    ];
    return { ...inv, history };
}

// ---------------------------------------------------------------------------
// Migration : facture v1 (legacy) → forme normalisée
// ---------------------------------------------------------------------------

/**
 * Migration runtime non-destructive :
 *   - Ajoute `paymentTermsDays = 30` si absent.
 *   - Recalcule `subtotalHt/totalVat/totalTtc/vatBreakdown` à partir des lignes.
 *   - Conserve `amount` pour compat KPIs.
 *   - Marque `legacy: true` si aucune ligne n'a de vatRate.
 *
 * Ne modifie JAMAIS le numéro, la date, le statut ou les paiements.
 */
export function migrateInvoice(inv: Invoice): Invoice {
    const totals = computeInvoiceTotals(inv.items || []);
    const migrated: Invoice = {
        ...inv,
        paymentTermsDays: inv.paymentTermsDays ?? 30,
        subtotalHt: totals.subtotalHt,
        totalVat: totals.totalVat,
        totalTtc: totals.totalTtc,
        vatBreakdown: totals.vatBreakdown,
        // amount préservé s'il existe et est positif ; sinon TTC calculé
        amount: Number.isFinite(inv.amount) && inv.amount > 0 ? inv.amount : totals.totalTtc,
        legacy: inv.legacy ?? !totals.hasExplicitVat,
        history: inv.history ?? [],
    };
    return migrated;
}

// ---------------------------------------------------------------------------
// Montant restant à payer (utilise vatBreakdown si présent, sinon legacy)
// ---------------------------------------------------------------------------

export function totalPaid(inv: Invoice): number {
    return (inv.payments || []).reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0);
}

export function invoiceTotalTtc(inv: Invoice): number {
    if (typeof inv.totalTtc === 'number' && inv.totalTtc > 0) return inv.totalTtc;
    if (Number.isFinite(inv.amount) && inv.amount > 0) return inv.amount;
    return computeInvoiceTotals(inv.items || []).totalTtc;
}

export function remainingDue(inv: Invoice): number {
    return Math.max(0, invoiceTotalTtc(inv) - totalPaid(inv));
}

// ---------------------------------------------------------------------------
// Note de crédit (Phase 4 — préparé ici car la logique de calcul s'applique)
// ---------------------------------------------------------------------------

/**
 * Construit une note de crédit à partir d'une facture émise (montants négatifs).
 * Le numéro reste vide — il sera attribué par le service de numérotation à
 * l'appelant.
 */
export function buildCreditNote(parent: Invoice, actor = 'Marion'): Omit<Invoice, 'number'> & { number: string } {
    const items: InvoiceItem[] = (parent.items || []).map((it) => ({
        ...it,
        id: `cn-${it.id}-${Date.now()}`,
        price: -Math.abs(it.price),
    }));
    const totals = computeInvoiceTotals(items);
    return {
        id: `inv-cn-${Date.now()}`,
        number: '',
        type: 'CreditNote',
        parentInvoiceId: parent.id,
        date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        currency: parent.currency,
        amount: totals.totalTtc,
        subtotalHt: totals.subtotalHt,
        totalVat: totals.totalVat,
        totalTtc: totals.totalTtc,
        vatBreakdown: totals.vatBreakdown,
        items,
        clientAddress: parent.clientAddress,
        clientDisplayName: parent.clientDisplayName,
        creditor: parent.creditor,
        history: [
            { at: new Date().toISOString(), actor, action: 'credit-note', note: `Avoir sur facture ${parent.number}` },
        ],
        paymentTermsDays: 0,
    };
}
