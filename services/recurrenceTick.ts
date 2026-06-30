/**
 * Recurrence Tick — service léger qui génère les factures récurrentes échues.
 *
 * Stratégie volontairement simple (pas de cron backend) :
 *   - Appelé au démarrage de FinancesPage (1× par chargement).
 *   - Parcourt tous les projets + standalone invoices.
 *   - Pour chaque facture avec `recurrence` actif et `nextRunAt` <= aujourd'hui :
 *       1. Clone la facture (mêmes lignes, mêmes totaux).
 *       2. Demande un nouveau numéro au backend.
 *       3. Met à jour la date d'émission, le statut → Draft.
 *       4. Met à jour `recurrence.nextRunAt` selon la fréquence.
 *       5. Sauvegarde via les callbacks fournis par l'appelant.
 *
 * Idempotence : tant que `nextRunAt` est mis à jour atomiquement, deux ticks
 * concurrents ne produisent pas de doublon.
 */

import type { Invoice, InvoiceRecurrence, Project } from '../types';
import { requestNextInvoiceNumber } from './invoiceNumbering';
import { appendAudit } from '../utils/invoiceEngine';

function nextRunDate(current: string, frequency: InvoiceRecurrence['frequency']): string {
    const d = new Date(current);
    if (Number.isNaN(d.getTime())) return current;
    if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
}

export interface TickContext {
    /** Met à jour un project — appelé pour chaque project modifié. */
    onUpdateProject: (p: Project) => void;
    /** Persiste une facture standalone (localStorage). */
    onUpsertStandalone: (inv: Invoice) => void;
    /** Appelé après chaque facture créée pour notifier l'utilisateur. */
    onNotify?: (message: string) => void;
}

async function spawnFrom(template: Invoice): Promise<Invoice> {
    const number = await requestNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];
    const dueDate = (() => {
        if (!template.paymentTermsDays) return undefined;
        const due = new Date();
        due.setDate(due.getDate() + (template.paymentTermsDays || 30));
        return due.toISOString().split('T')[0];
    })();
    const cloned: Invoice = {
        ...template,
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        number,
        numberLocked: false,
        date: today,
        dueDate,
        status: 'Draft',
        payments: [],
        reminders: [],
        issuedAt: undefined,
        sentAt: undefined,
        paidAt: undefined,
        voidedAt: undefined,
        voidReason: undefined,
        parentInvoiceId: undefined,
        recurrence: undefined, // les clones ne sont pas eux-mêmes récurrents
        history: [
            { at: new Date().toISOString(), actor: 'system', action: 'create', note: `Cloné depuis ${template.number} (récurrente)` },
        ],
    };
    return cloned;
}

/**
 * Exécute le tick. Retourne le nombre de factures générées.
 * Idempotent : ne génère que celles dont `recurrence.nextRunAt` <= aujourd'hui.
 */
export async function runRecurrenceTick(
    projects: Project[],
    standaloneInvoices: Invoice[],
    ctx: TickContext,
): Promise<number> {
    const todayISO = new Date().toISOString().split('T')[0];
    let generated = 0;

    // --- Projects ---
    for (const project of projects) {
        const due = project.invoices.filter(inv => inv.recurrence && inv.recurrence.nextRunAt <= todayISO
            && (!inv.recurrence.until || inv.recurrence.until >= todayISO));
        if (due.length === 0) continue;

        let updatedInvoices = [...project.invoices];
        for (const tpl of due) {
            try {
                const child = await spawnFrom(tpl);
                updatedInvoices = updatedInvoices.map(i =>
                    i.id === tpl.id
                        ? appendAudit({
                            ...i,
                            recurrence: { ...tpl.recurrence!, nextRunAt: nextRunDate(tpl.recurrence!.nextRunAt, tpl.recurrence!.frequency) },
                        }, { action: 'recurrence-tick', actor: 'system', note: `Génère ${child.number}` })
                        : i,
                );
                updatedInvoices.push(child);
                generated++;
                ctx.onNotify?.(`Facture récurrente ${child.number} générée pour ${project.clientName}`);
            } catch (err) {
                console.error('Recurrence tick failed for invoice', tpl.id, err);
            }
        }
        ctx.onUpdateProject({ ...project, invoices: updatedInvoices });
    }

    // --- Standalone ---
    const dueSolo = standaloneInvoices.filter(inv => inv.recurrence && inv.recurrence.nextRunAt <= todayISO
        && (!inv.recurrence.until || inv.recurrence.until >= todayISO));
    for (const tpl of dueSolo) {
        try {
            const child = await spawnFrom(tpl);
            const updated = appendAudit({
                ...tpl,
                recurrence: { ...tpl.recurrence!, nextRunAt: nextRunDate(tpl.recurrence!.nextRunAt, tpl.recurrence!.frequency) },
            }, { action: 'recurrence-tick', actor: 'system', note: `Génère ${child.number}` });
            ctx.onUpsertStandalone(updated);
            ctx.onUpsertStandalone(child);
            generated++;
            ctx.onNotify?.(`Facture récurrente ${child.number} générée (sans dossier)`);
        } catch (err) {
            console.error('Recurrence tick failed for standalone invoice', tpl.id, err);
        }
    }

    return generated;
}
