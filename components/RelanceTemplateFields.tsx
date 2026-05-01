/**
 * RelanceTemplateFields — édition des modèles de relance facture (polie / ferme).
 *
 * Vit naturellement dans la section Finance puisque c'est là que les relances
 * sont déclenchées (FinanceDashboard → Revenus → Relancer).
 */
import React from 'react';
import { useUIStore } from '../stores';

export const RelanceTemplateFields: React.FC = () => {
    const polite = useUIStore((s) => s.relanceTemplatePolite);
    const firm = useUIStore((s) => s.relanceTemplateFirm);
    const setPolite = useUIStore((s) => s.setRelanceTemplatePolite);
    const setFirm = useUIStore((s) => s.setRelanceTemplateFirm);
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Relance polie</label>
                <textarea
                    value={polite}
                    onChange={(e) => setPolite(e.target.value)}
                    rows={7}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-brand-orange dark:text-white font-mono text-xs leading-relaxed"
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Relance ferme</label>
                <textarea
                    value={firm}
                    onChange={(e) => setFirm(e.target.value)}
                    rows={7}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-brand-orange dark:text-white font-mono text-xs leading-relaxed"
                />
            </div>
        </div>
    );
};
