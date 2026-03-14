import { MeetingReport } from '../types';

function escapeHtml(input: string): string {
    return String(input || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sectionList(title: string, items: string[]) {
    if (!items?.length) return '';
    return `
      <section style="margin: 18px 0;">
        <h3 style="margin: 0 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: .08em;">${escapeHtml(title)}</h3>
        <ul style="margin: 0; padding-left: 18px; color: #111827; line-height: 1.5;">
          ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>
    `;
}

function buildReportHtml(report: MeetingReport, variant: 'internal' | 'client'): string {
    const generated = new Date(report.generatedAt || Date.now()).toLocaleString('fr-CH');
    const duration = typeof report.durationSeconds === 'number'
        ? `${Math.floor(report.durationSeconds / 60)} min`
        : 'N/A';
    const complianceLine = report.consentAccepted
        ? `Consentement: confirmé | Rétention: ${report.retentionDays || 30} jours`
        : '';
    return `
      <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; padding: 24px; max-width: 800px;">
        <header style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 18px;">
          <h1 style="margin: 0; font-size: 26px;">Compte-rendu de réunion</h1>
          <p style="margin: 6px 0 0; color: #475569;">Client: <strong>${escapeHtml(report.clientName)}</strong></p>
          <p style="margin: 4px 0 0; color: #475569;">Généré: ${escapeHtml(generated)} | Durée: ${escapeHtml(duration)}</p>
          ${complianceLine ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">${escapeHtml(complianceLine)}</p>` : ''}
        </header>

        <section style="margin: 18px 0;">
          <h3 style="margin: 0 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: .08em;">Résumé exécutif</h3>
          <p style="margin: 0; line-height: 1.6;">${escapeHtml(report.summary || '')}</p>
        </section>

        ${sectionList('Points clés', report.keyPoints || [])}
        ${sectionList('Décisions', report.decisions || [])}
        ${sectionList('Prochaines étapes', report.nextSteps || [])}
        ${sectionList('Risques', report.risks || [])}
        ${sectionList('Objections', report.objections || [])}

        <section style="margin: 18px 0;">
          <h3 style="margin: 0 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: .08em;">Actions à exécuter</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:1px solid #e2e8f0; padding: 6px;">Tâche</th>
                <th style="text-align:left; border-bottom:1px solid #e2e8f0; padding: 6px;">Responsable</th>
                <th style="text-align:left; border-bottom:1px solid #e2e8f0; padding: 6px;">Échéance</th>
                <th style="text-align:left; border-bottom:1px solid #e2e8f0; padding: 6px;">Priorité</th>
              </tr>
            </thead>
            <tbody>
              ${(report.tasks || []).map(task => `
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9; padding: 6px;">${escapeHtml(task.title || '')}</td>
                  <td style="border-bottom:1px solid #f1f5f9; padding: 6px;">${escapeHtml(task.owner || '-')}</td>
                  <td style="border-bottom:1px solid #f1f5f9; padding: 6px;">${escapeHtml(task.deadline || '-')}</td>
                  <td style="border-bottom:1px solid #f1f5f9; padding: 6px;">${escapeHtml(task.priority || 'Medium')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>

        ${variant === 'internal' && report.followUpDraft ? `
          <section style="margin: 18px 0;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: .08em;">Brouillon follow-up</h3>
            <p style="margin: 0; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(report.followUpDraft)}</p>
          </section>
        ` : ''}

        ${variant === 'internal' && report.evidence?.length ? `
          <section style="margin: 18px 0;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: .08em;">Éléments de preuve</h3>
            <ul style="margin: 0; padding-left: 18px; color: #111827; line-height: 1.5;">
              ${(report.evidence || []).map((e) => `<li>${escapeHtml(e.quote)}${e.speaker ? ` (${escapeHtml(e.speaker)})` : ''}</li>`).join('')}
            </ul>
          </section>
        ` : ''}

        ${variant === 'internal' && report.transcriptExcerpt ? `
          <section style="margin: 18px 0;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: .08em;">Extrait de transcription</h3>
            <p style="margin: 0; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(report.transcriptExcerpt)}</p>
          </section>
        ` : ''}
      </div>
    `;
}

export async function exportMeetingReportPdf(report: MeetingReport, variant: 'internal' | 'client' = 'internal') {
    const { jsPDF } = await import('jspdf');
    const filenameClient = (report.clientName || 'client').replace(/\s+/g, '-').toLowerCase();
    const filename = `meeting-report-${variant}-${filenameClient}.pdf`;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 5.2;
    let y = margin;

    const ensureSpace = (requiredHeight: number) => {
        if (y + requiredHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };

    const writeBlock = (text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number]; bullet?: boolean }) => {
        const value = String(text || '').trim();
        if (!value) return;
        const size = options?.size || 11;
        const bulletPrefix = options?.bullet ? '- ' : '';
        doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        if (options?.color) {
            doc.setTextColor(options.color[0], options.color[1], options.color[2]);
        } else {
            doc.setTextColor(15, 23, 42);
        }
        const lines = doc.splitTextToSize(`${bulletPrefix}${value}`, maxWidth) as string[];
        ensureSpace(lines.length * lineHeight + 2);
        lines.forEach((line) => {
            doc.text(line, margin, y);
            y += lineHeight;
        });
        y += 1.2;
    };

    const writeSectionTitle = (title: string) => {
        ensureSpace(8);
        y += 1;
        writeBlock(title.toUpperCase(), { size: 11, bold: true, color: [51, 65, 85] });
    };

    const writeList = (title: string, items: string[]) => {
        if (!items?.length) return;
        writeSectionTitle(title);
        items.forEach((item) => writeBlock(item, { bullet: true }));
    };

    const generated = new Date(report.generatedAt || Date.now()).toLocaleString('fr-CH');
    const duration = typeof report.durationSeconds === 'number' ? `${Math.floor(report.durationSeconds / 60)} min` : 'N/A';
    const complianceLine = report.consentAccepted
        ? `Consentement confirme | Retention: ${report.retentionDays || 30} jours`
        : '';

    writeBlock('Compte-rendu de reunion', { size: 18, bold: true });
    writeBlock(`Client: ${report.clientName || '-'}`, { size: 11, bold: true, color: [71, 85, 105] });
    writeBlock(`Genere: ${generated} | Duree: ${duration}`, { size: 10, color: [100, 116, 139] });
    if (complianceLine) {
        writeBlock(complianceLine, { size: 10, color: [100, 116, 139] });
    }

    writeSectionTitle('Resume executif');
    writeBlock(report.summary || '-');

    writeList('Points cles', report.keyPoints || []);
    writeList('Decisions', report.decisions || []);
    writeList('Prochaines etapes', report.nextSteps || []);
    writeList('Risques', report.risks || []);
    writeList('Objections', report.objections || []);

    if ((report.tasks || []).length) {
        writeSectionTitle('Actions a executer');
        (report.tasks || []).forEach((task) => {
            writeBlock(`${task.title || '(Sans titre)'}`, { bullet: true, bold: true });
            writeBlock(`Responsable: ${task.owner || '-'} | Echeance: ${task.deadline || '-'} | Priorite: ${task.priority || 'Medium'}`, { size: 10, color: [71, 85, 105] });
        });
    }

    if (variant === 'internal' && report.followUpDraft) {
        writeSectionTitle('Brouillon follow-up');
        writeBlock(report.followUpDraft);
    }

    if (variant === 'internal' && report.evidence?.length) {
        writeSectionTitle('Elements de preuve');
        report.evidence.forEach((entry) => writeBlock(`${entry.quote}${entry.speaker ? ` (${entry.speaker})` : ''}`, { bullet: true }));
    }

    if (variant === 'internal' && report.transcriptExcerpt) {
        writeSectionTitle('Extrait de transcription');
        writeBlock(report.transcriptExcerpt);
    }

    doc.save(filename);
}

