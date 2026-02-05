import React, { useState } from 'react';
import { Bug, Send, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal } from './Shared';

interface BugReporterProps {}

export const BugReporter: React.FC<BugReporterProps> = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async () => {
        if (!title || !description) return;
        
        setStatus('sending');
        
        // Collect technical context
        const context = `
### Context
- **URL**: ${window.location.href}
- **User Agent**: ${navigator.userAgent}
- **Screen**: ${window.innerWidth}x${window.innerHeight}
- **Time**: ${new Date().toISOString()}
        `;

        const fullBody = `${description}\n\n---\n${context}`;

        try {
            const res = await fetch('http://127.0.0.1:5003/api/report-bug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    body: fullBody,
                    labels: ['bug', 'user-report']
                })
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                setStatus('success');
                setTimeout(() => {
                    setIsOpen(false);
                    setStatus('idle');
                    setTitle('');
                    setDescription('');
                }, 2000);
            } else {
                setStatus('error');
                setErrorMessage(data.error || "Erreur inconnue");
            }
        } catch (e) {
            setStatus('error');
            setErrorMessage("Impossible de contacter le serveur.");
        }
    };

    return (
        <>
            {/* Floating Trigger */}
            <button 
                id="bug-reporter-btn"
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-50 p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-full shadow-sm hover:shadow-md transition-all hover:scale-110 opacity-50 hover:opacity-100"
                title="Signaler un problème"
            >
                <Bug size={16} />
            </button>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Signaler un Bug 🐞" width="max-w-lg">
                <div className="space-y-4">
                    {status === 'success' ? (
                        <div className="flex flex-col items-center justify-center py-8 text-green-500 animate-in zoom-in">
                            <CheckCircle size={48} className="mb-4" />
                            <h3 className="text-xl font-bold">Envoyé !</h3>
                            <p className="text-slate-500 text-sm">Merci pour votre aide.</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-600 dark:text-blue-300 flex items-start gap-2">
                                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                <p>Décrivez le problème simplement. Les détails techniques seront ajoutés automatiquement.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre court</label>
                                <input 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Le bouton upload ne marche pas..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Que faisiez-vous quand c'est arrivé ?"
                                    className="w-full h-32 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white resize-none"
                                />
                            </div>

                            {status === 'error' && (
                                <div className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded">
                                    Erreur: {errorMessage}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                                <button 
                                    onClick={handleSubmit}
                                    disabled={!title || !description || status === 'sending'}
                                    className="bg-red-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none"
                                >
                                    {status === 'sending' ? 'Envoi...' : <><Send size={16} /> Signaler</>}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </>
    );
};
