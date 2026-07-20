/**
 * invoiceSummaryPdf — Builds a lightweight, professional PDF summary of an
 * invoice for attaching to an email (see components/email/useEmailWidget.ts,
 * "Joindre facture (PDF)…"). This is a summary document, distinct from the
 * full QR-bill invoice generated in InvoiceBuilder.tsx (never touched here).
 */
import { jsPDF } from 'jspdf';

export interface InvoiceSummaryLineItem {
    desc: string;
    quantity: number;
    price: number;
}

export interface InvoiceSummaryPdfInput {
    invoiceNumber: string;
    clientName: string;
    amount: number;
    currency: string;
    dueDate?: string;
    date?: string;
    status: string;
    items?: InvoiceSummaryLineItem[];
    /** Branding — nom et coordonnées de Marion / Eonora Tech (depuis Paramètres). */
    agencyName: string;
    agencyWebsite?: string;
}

function formatAmount(value: number, currency: string): string {
    return `${value.toFixed(2)} ${currency}`;
}

/** Builds the invoice summary PDF and returns it as a `File`, ready to attach to an email. */
export function buildInvoiceSummaryPdf(input: InvoiceSummaryPdfInput): File {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const writeLine = (text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number }) => {
        const size = options?.size ?? 11;
        const color = options?.color ?? [15, 23, 42];
        doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(text, margin, y);
        y += options?.gap ?? size * 0.6;
    };

    // -- Header : branding --------------------------------------------------
    writeLine(input.agencyName, { size: 20, bold: true, gap: 8 });
    if (input.agencyWebsite) {
        writeLine(input.agencyWebsite, { size: 10, color: [100, 116, 139], gap: 10 });
    } else {
        y += 4;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // -- Title ----------------------------------------------------------------
    writeLine('Résumé de facture', { size: 16, bold: true, gap: 10 });

    // -- Key/value summary block ---------------------------------------------
    const rows: [string, string][] = [
        ['Facture N°', input.invoiceNumber],
        ['Client', input.clientName],
        ['Montant', formatAmount(input.amount, input.currency)],
    ];
    if (input.date) rows.push(['Date', input.date]);
    if (input.dueDate) rows.push(['Échéance', input.dueDate]);
    rows.push(['Statut', input.status]);

    rows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`${label} :`, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(value, margin + 38, y);
        y += 7;
    });

    // -- Line items (if provided) ---------------------------------------------
    if (input.items && input.items.length > 0) {
        y += 6;
        writeLine('Détail des prestations', { size: 12, bold: true, color: [51, 65, 85], gap: 8 });

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;

        input.items.forEach((item) => {
            const lineTotal = formatAmount(item.quantity * item.price, input.currency);
            const descLines = doc.splitTextToSize(item.desc || '(sans description)', maxWidth - 30) as string[];
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            descLines.forEach((line, idx) => {
                doc.text(line, margin, y + idx * 5);
            });
            doc.setTextColor(71, 85, 105);
            doc.text(`${item.quantity} × ${formatAmount(item.price, input.currency)} = ${lineTotal}`, pageWidth - margin, y + (descLines.length - 1) * 5, { align: 'right' });
            y += descLines.length * 5 + 3;
        });
    }

    // -- Footer -----------------------------------------------------------------
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
        'Ce document est un résumé informatif — il ne remplace pas la facture officielle avec référence QR.',
        margin, pageHeight - margin,
    );

    const blob = doc.output('blob');
    return new File([blob], `Facture-${input.invoiceNumber}.pdf`, { type: 'application/pdf' });
}
