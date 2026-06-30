/**
 * Finance KPIs v2 — calculs Swiss-grade pour le dashboard.
 *
 * Inclus :
 *   - DSO (Days Sales Outstanding) — moyenne (jours entre émission et paiement)
 *     sur 12 derniers mois.
 *   - Ratio d'impayés — totalOverdue / totalIssued sur 12 mois glissants.
 *   - Prévisionnel 12 mois — somme des récurrentes connues + moyenne mobile.
 *   - TVA à reverser — somme `totalVat` des factures `Paid` du trimestre courant,
 *     ventilée par taux.
 *   - Alertes overdue — liste des factures `dueDate < today` non payées.
 *   - Carte conformité — checks IDE/n° TVA/IBAN/numérotation continue.
 *
 * Toutes les fonctions ignorent les factures `Voided` et `Archived` (CO art. 958f).
 */

import type { Invoice, Project, SwissVatRate, VatBreakdownEntry } from '../types';
import { invoiceEffectiveAmount } from '../utils';
import { isArchivedStatus } from './invoiceEngine';
import { isValidIban } from './swissQrBill';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function isInvoiceLike(inv: Invoice): boolean {
    return inv.type === 'Invoice' && !isArchivedStatus(inv.status);
}

function within12Months(dateIso: string | undefined, now: Date): boolean {
    if (!dateIso) return false;
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return false;
    const horizon = new Date(now);
    horizon.setFullYear(horizon.getFullYear() - 1);
    return d >= horizon && d <= now;
}

// ---------------------------------------------------------------------------
// DSO
// ---------------------------------------------------------------------------

export interface DsoResult {
    days: number | null;       // null si pas de facture payée sur 12 mois
    sampleSize: number;
}

export function computeDso(invoices: Invoice[], now: Date = new Date()): DsoResult {
    const samples: number[] = [];
    for (const inv of invoices) {
        if (!isInvoiceLike(inv)) continue;
        if (inv.status !== 'Paid') continue;
        const issued = inv.issuedAt || inv.date;
        const paid = inv.paidAt
            || (inv.payments && inv.payments.length > 0 ? inv.payments[inv.payments.length - 1].date : null);
        if (!issued || !paid) continue;
        if (!within12Months(paid, now)) continue;
        const issuedDate = new Date(issued).getTime();
        const paidDate = new Date(paid).getTime();
        if (!Number.isFinite(issuedDate) || !Number.isFinite(paidDate) || paidDate < issuedDate) continue;
        const days = Math.round((paidDate - issuedDate) / MS_PER_DAY);
        samples.push(days);
    }
    if (samples.length === 0) return { days: null, sampleSize: 0 };
    const avg = samples.reduce((s, n) => s + n, 0) / samples.length;
    return { days: Math.round(avg), sampleSize: samples.length };
}

// ---------------------------------------------------------------------------
// Ratio d'impayés
// ---------------------------------------------------------------------------

export interface OverdueRatioResult {
    ratio: number;             // 0..1
    overdue: number;
    issued: number;
}

export function computeOverdueRatio(invoices: Invoice[], now: Date = new Date()): OverdueRatioResult {
    let overdue = 0;
    let issued = 0;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    for (const inv of invoices) {
        if (!isInvoiceLike(inv)) continue;
        if (!within12Months(inv.date, now)) continue;
        const eff = invoiceEffectiveAmount(inv);
        issued += eff;
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        if (!due || Number.isNaN(due.getTime())) continue;
        if (due >= todayStart) continue;
        if (inv.status === 'Paid') continue;
        const paid = (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        overdue += Math.max(0, eff - paid);
    }
    return {
        ratio: issued > 0 ? Math.min(1, overdue / issued) : 0,
        overdue,
        issued,
    };
}

// ---------------------------------------------------------------------------
// Prévisionnel 12 mois
// ---------------------------------------------------------------------------

export interface ForecastMonth {
    month: string;          // "2026-06"
    label: string;          // "Juin 2026"
    recurring: number;
    average: number;
    total: number;
}

export function computeForecast12Months(invoices: Invoice[], now: Date = new Date()): ForecastMonth[] {
    // Moyenne mobile = moyenne mensuelle du CA sur 6 mois glissants payés.
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const paidSamples = invoices
        .filter(i => isInvoiceLike(i) && i.status === 'Paid')
        .map(i => ({
            date: new Date(i.paidAt || i.date),
            amount: invoiceEffectiveAmount(i),
        }))
        .filter(s => !Number.isNaN(s.date.getTime()) && s.date >= sixMonthsAgo && s.date <= now);
    const avgMonthly = paidSamples.length > 0
        ? paidSamples.reduce((s, x) => s + x.amount, 0) / 6
        : 0;

    // Récurrentes : projeter les hits sur les 12 prochains mois.
    const recurring = invoices.filter(i => i.recurrence && isInvoiceLike(i));
    const forecastByMonth = new Map<string, number>();
    for (const inv of recurring) {
        const r = inv.recurrence!;
        let cursor = new Date(r.nextRunAt);
        const horizon = new Date(now);
        horizon.setMonth(horizon.getMonth() + 12);
        const until = r.until ? new Date(r.until) : horizon;
        let safety = 0;
        while (cursor <= horizon && cursor <= until && safety < 50) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            forecastByMonth.set(key, (forecastByMonth.get(key) || 0) + invoiceEffectiveAmount(inv));
            if (r.frequency === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
            else if (r.frequency === 'quarterly') cursor.setMonth(cursor.getMonth() + 3);
            else cursor.setFullYear(cursor.getFullYear() + 1);
            safety++;
        }
    }

    const FR_MONTH = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juill.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    const out: ForecastMonth[] = [];
    for (let i = 1; i <= 12; i++) {
        const m = new Date(now);
        m.setMonth(m.getMonth() + i);
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
        const recurringAmount = forecastByMonth.get(key) || 0;
        out.push({
            month: key,
            label: `${FR_MONTH[m.getMonth()]} ${m.getFullYear()}`,
            recurring: recurringAmount,
            average: avgMonthly,
            total: recurringAmount + avgMonthly,
        });
    }
    return out;
}

// ---------------------------------------------------------------------------
// TVA à reverser (trimestre courant)
// ---------------------------------------------------------------------------

export interface VatPayable {
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    year: number;
    breakdown: VatBreakdownEntry[];
    total: number;
}

export function computeVatPayable(invoices: Invoice[], now: Date = new Date()): VatPayable {
    const m = now.getMonth();
    const quarter = (Math.floor(m / 3) + 1) as 1 | 2 | 3 | 4;
    const qStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
    const qEnd = new Date(now.getFullYear(), quarter * 3, 0, 23, 59, 59);

    const acc = new Map<number, { netHt: number; vat: number }>();
    let total = 0;
    for (const inv of invoices) {
        if (!isInvoiceLike(inv)) continue;
        if (inv.status !== 'Paid') continue;
        const paidAt = inv.paidAt || inv.date;
        const d = new Date(paidAt);
        if (Number.isNaN(d.getTime())) continue;
        if (d < qStart || d > qEnd) continue;
        const breakdown = inv.vatBreakdown || [];
        for (const b of breakdown) {
            const cur = acc.get(b.rate) || { netHt: 0, vat: 0 };
            acc.set(b.rate, { netHt: cur.netHt + b.netHt, vat: cur.vat + b.vat });
            total += b.vat;
        }
    }
    const breakdown: VatBreakdownEntry[] = Array.from(acc.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([rate, v]) => ({ rate: rate as SwissVatRate, netHt: Math.round(v.netHt * 100) / 100, vat: Math.round(v.vat * 100) / 100 }));
    return {
        quarter: `Q${quarter}` as VatPayable['quarter'],
        year: now.getFullYear(),
        breakdown,
        total: Math.round(total * 100) / 100,
    };
}

// ---------------------------------------------------------------------------
// Alertes overdue
// ---------------------------------------------------------------------------

export interface OverdueAlert {
    id: string;
    number: string;
    clientName: string;
    daysLate: number;
    amountDue: number;
    currency: string;
}

export function computeOverdueAlerts(
    projects: Project[],
    standalone: Invoice[],
    now: Date = new Date(),
): OverdueAlert[] {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const out: OverdueAlert[] = [];
    const consider = (inv: Invoice, clientName: string) => {
        if (!isInvoiceLike(inv)) return;
        if (inv.status === 'Paid') return;
        if (!inv.dueDate) return;
        const due = new Date(inv.dueDate);
        if (Number.isNaN(due.getTime()) || due >= today) return;
        const paid = (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const amountDue = Math.max(0, invoiceEffectiveAmount(inv) - paid);
        if (amountDue <= 0) return;
        out.push({
            id: inv.id,
            number: inv.number,
            clientName,
            daysLate: Math.floor((today.getTime() - due.getTime()) / MS_PER_DAY),
            amountDue,
            currency: inv.currency || 'CHF',
        });
    };
    for (const p of projects) for (const inv of p.invoices) consider(inv, p.clientName);
    for (const inv of standalone) consider(inv, inv.clientDisplayName || 'Sans dossier');
    return out.sort((a, b) => b.daysLate - a.daysLate);
}

// ---------------------------------------------------------------------------
// Conformité (mentions légales + numérotation)
// ---------------------------------------------------------------------------

export interface ComplianceCheck {
    id: 'ide' | 'vatNumber' | 'iban' | 'numbering';
    label: string;
    ok: boolean;
    hint?: string;
}

export interface ComplianceContext {
    agencyIde: string;
    agencyVatNumber: string;
    iban: string;
    /** Liste des numéros de factures émises sur l'année (triée). */
    issuedNumbers: string[];
}

const IDE_RE = /^CHE-\d{3}\.\d{3}\.\d{3}$/;
const VAT_RE = /^CHE-\d{3}\.\d{3}\.\d{3}\s+TVA$/;

export function checkCompliance(ctx: ComplianceContext): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    checks.push({
        id: 'ide',
        label: 'N° IDE / UID renseigné',
        ok: IDE_RE.test(ctx.agencyIde.trim()),
        hint: 'Format attendu : CHE-xxx.xxx.xxx',
    });
    checks.push({
        id: 'vatNumber',
        label: 'N° TVA configuré (si assujettie)',
        ok: ctx.agencyVatNumber.trim() === '' || VAT_RE.test(ctx.agencyVatNumber.trim()),
        hint: ctx.agencyVatNumber ? 'Format attendu : CHE-xxx.xxx.xxx TVA' : 'Optionnel si CA < 100\'000 CHF',
    });
    checks.push({
        id: 'iban',
        label: 'IBAN bancaire valide',
        ok: isValidIban(ctx.iban),
        hint: 'Vérifie le checksum modulo 97',
    });
    // Numérotation continue : on cherche des trous dans la séquence numérique.
    let numberingOk = true;
    let numberingHint: string | undefined;
    const seqs = ctx.issuedNumbers
        .map(n => {
            const m = n.match(/(\d+)\s*$/);
            return m ? parseInt(m[1], 10) : null;
        })
        .filter((x): x is number => x !== null)
        .sort((a, b) => a - b);
    if (seqs.length >= 2) {
        for (let i = 1; i < seqs.length; i++) {
            if (seqs[i] !== seqs[i - 1] + 1) {
                numberingOk = false;
                numberingHint = `Saut détecté : ${seqs[i - 1]} → ${seqs[i]}`;
                break;
            }
        }
    }
    checks.push({
        id: 'numbering',
        label: 'Numérotation continue',
        ok: numberingOk,
        hint: numberingHint || 'Aucun saut détecté sur la séquence',
    });
    return checks;
}
