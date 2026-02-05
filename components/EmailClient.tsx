import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, RefreshCw, AlertCircle, User, ExternalLink, AtSign, Send, X, ArrowLeft, Edit, Trash2, Reply, Forward, Star, Inbox, Save, Mic } from 'lucide-react';

interface Email {
    id: string;
    subject: string;
    from: string;
    date: string;
    snippet: string;
    body?: string;
    isUnread?: boolean;
}

interface EmailClientProps {
    clientEmail?: string;
    initialCompose?: { to: string, subject: string, body: string };
    onClose?: () => void;
}

export const EmailClient: React.FC<EmailClientProps> = ({ clientEmail, initialCompose, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [emails, setEmails] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // View State
    const [view, setView] = useState<'list' | 'read' | 'compose'>(initialCompose ? 'compose' : 'list');
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [draft, setDraft] = useState(initialCompose || { to: '', subject: '', body: '' });
    const [currentFolder, setCurrentFolder] = useState<'inbox' | 'sent' | 'drafts'>('inbox');

    // Voice Dictation
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState('');
    const recognitionRef = useRef<any>(null);
    const draftBodyRef = useRef(draft.body);

    useEffect(() => {
        draftBodyRef.current = draft.body;
    }, [draft.body]);

    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            alert("Dictée non supportée par ce navigateur."); return;
        }
        
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            setInterimText('');
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';

        recognition.onstart = () => {
            setIsListening(true);
            setInterimText('Écoute en cours...');
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimText('');
        };

        recognition.onerror = (event: any) => {
            console.error("Dictation error", event.error);
            setIsListening(false);
            setInterimText('Erreur micro');
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let currentInterim = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    currentInterim += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                const newBody = draftBodyRef.current + (draftBodyRef.current && !draftBodyRef.current.endsWith(' ') && !draftBodyRef.current.endsWith('\n') ? ' ' : '') + finalTranscript;
                setDraft(prev => ({ ...prev, body: newBody }));
            }
            
            if (currentInterim) {
                setInterimText(currentInterim);
            }
        };

        recognition.start();
    };

    // Fetch Emails Function
    const fetchEmails = async (u: string, p: string, folder: string = 'inbox') => {
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch('http://127.0.0.1:5003/api/email/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: u, 
                    password: p, 
                    limit: 30, 
                    filterEmail: clientEmail,
                    folder: folder 
                })
            });
            const data = await res.json();
            
            if (data.emails) {
                const processed = data.emails.map((e: any) => ({
                    ...e,
                    isUnread: e.isUnread !== undefined ? e.isUnread : (folder === 'inbox' && Math.random() > 0.8)
                }));
                setEmails(processed);
                setIsConnected(true);
                sessionStorage.setItem('infomaniak_email', u);
                sessionStorage.setItem('infomaniak_pwd', p);
            } else {
                setError(data.error || 'Erreur de connexion');
                setIsConnected(false);
            }
        } catch (e) {
            setError('Impossible de joindre le serveur');
        } finally {
            setIsLoading(false);
        }
    };

    // Initial Mount Effect
    useEffect(() => {
        const storedEmail = sessionStorage.getItem('infomaniak_email');
        const storedPwd = sessionStorage.getItem('infomaniak_pwd');
        if (storedEmail && storedPwd) {
            setEmail(storedEmail);
            setPassword(storedPwd);
            if (!initialCompose) {
                // We can't call fetchEmails here safely if it depends on state/props not in dep array
                // But fetchEmails uses args, so it's fine. 
                // However, fetchEmails is defined inside component, so it changes every render.
                // It's better to move this logic or suppress warning if we know it's fine.
                // For this fix, I'll call it directly.
                fetchEmails(storedEmail, storedPwd, currentFolder);
            }
            setIsConnected(true);
        }
    }, []); // Run once

    // Re-fetch when folder changes
    useEffect(() => {
        if (isConnected && email && password) {
            fetchEmails(email, password, currentFolder);
        }
    }, [currentFolder]); // When folder changes

    // Auto-refresh every 60 seconds
    useEffect(() => {
        let interval: any;
        if (isConnected && email && password) {
            interval = setInterval(() => {
                fetchEmails(email, password, currentFolder);
            }, 60000);
        }
        return () => clearInterval(interval);
    }, [isConnected, email, password, currentFolder]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        fetchEmails(email, password, 'inbox');
    };

    const handleLogout = () => {
        sessionStorage.removeItem('infomaniak_email');
        sessionStorage.removeItem('infomaniak_pwd');
        setIsConnected(false);
        setPassword('');
        setEmails([]);
    };

    const handleOpenEmail = async (mail: Email) => {
        setSelectedEmail(mail);
        setView('read');
        
        try {
            const res = await fetch('http://127.0.0.1:5003/api/email/body', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: email, 
                    password: password, 
                    id: mail.id 
                })
            });
            const data = await res.json();
            if (data.success) {
                setSelectedEmail(prev => prev ? { ...prev, body: data.html || data.text } : null);
            }
        } catch (e) {
            console.error("Failed to load email body", e);
        }

        setEmails(prev => prev.map(e => e.id === mail.id ? { ...e, isUnread: false } : e));
    };

    const handleCompose = () => {
        setDraft({ to: clientEmail || '', subject: '', body: '' });
        setView('compose');
    };

    const handleReply = () => {
        if (!selectedEmail) return;
        setDraft({
            to: selectedEmail.from.replace(/<.*?>/g, '').trim(),
            subject: `Re: ${selectedEmail.subject}`,
            body: `\n\n\n--- Le ${new Date(selectedEmail.date).toLocaleString()} ---\n${selectedEmail.snippet}`
        });
        setView('compose');
    };

    const handleSendDraft = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:5003/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: email,
                    password: password,
                    to: draft.to,
                    subject: draft.subject,
                    body: draft.body
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Email envoyé à ${draft.to} !`);
                setView('list');
            } else {
                alert("Erreur lors de l'envoi : " + data.error);
            }
        } catch (e) {
            alert("Impossible de joindre le serveur SMTP.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:5003/api/email/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: email,
                    password: password,
                    to: draft.to,
                    subject: draft.subject,
                    body: draft.body
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Brouillon enregistré sur le serveur !");
                setView('list');
            } else {
                alert("Erreur sauvegarde brouillon : " + data.error);
            }
        } catch (e) {
            alert("Erreur réseau.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDERERS ---

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl">
                <div className="w-full max-w-sm">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none text-blue-600 animate-in zoom-in duration-500">
                            <Mail size={40} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-center mb-2 dark:text-white text-slate-800">Infomaniak Mail</h3>
                    <p className="text-center text-slate-500 text-sm mb-8 leading-relaxed">
                        Connectez votre compte pro pour gérer les emails {clientEmail ? <span>de <strong className="text-slate-800 dark:text-slate-200">{clientEmail}</strong></span> : "récents"}.
                    </p>
                    
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                            <div className="relative">
                                <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                                    placeholder="marion@agence.ch"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mot de passe</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                        
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 transition-all disabled:opacity-70 transform active:scale-95"
                        >
                            {isLoading ? <RefreshCw className="animate-spin" /> : "Connexion"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (view === 'compose') {
        return (
            <div className="h-full flex flex-col animate-in slide-in-from-right-4 duration-300 bg-white dark:bg-slate-800 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-serif font-bold dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-brand-orange flex items-center justify-center">
                             <Edit size={16} />
                        </div>
                        Nouveau Message
                    </h3>
                    <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4 flex-1 flex flex-col">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">À</label>
                        <input 
                            value={draft.to} 
                            onChange={e => setDraft({...draft, to: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Sujet</label>
                        <input 
                            value={draft.subject} 
                            onChange={e => setDraft({...draft, subject: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                        />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Message</label>
                            {isListening && <span className="text-xs font-bold text-red-500 animate-pulse mr-2">{interimText || '...'}</span>}
                        </div>
                        <textarea 
                            value={draft.body} 
                            onChange={e => setDraft({...draft, body: e.target.value})}
                            className="w-full h-full min-h-[200px] bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-brand-orange dark:text-white resize-none"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        onClick={toggleListening}
                        className={`p-3 rounded-xl transition-all flex items-center justify-center ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                        title="Dicter l'email"
                    >
                        <Mic size={20} />
                    </button>
                    <button 
                        onClick={handleSaveDraft}
                        className="px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
                    >
                        {isLoading ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16} />} Enregistrer Brouillon
                    </button>
                    <button 
                        onClick={handleSendDraft}
                        className="px-8 py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-200 dark:shadow-none transition-all flex items-center gap-2"
                    >
                        {isLoading ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16} />} Envoyer
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'read' && selectedEmail) {
        return (
            <div className="h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
                {/* Header Actions */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                        <ArrowLeft size={18} /> Retour
                    </button>
                    <div className="flex gap-2">
                        <button onClick={handleReply} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Répondre"><Reply size={18} /></button>
                        <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Transférer"><Forward size={18} /></button>
                        <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Supprimer"><Trash2 size={18} /></button>
                    </div>
                </div>

                {/* Email Content */}
                <div className="flex-1 overflow-y-auto pr-2">
                    <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white mb-4">{selectedEmail.subject}</h2>
                    
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                            {selectedEmail.from.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{selectedEmail.from}</div>
                            <div className="text-xs text-slate-400">{new Date(selectedEmail.date).toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {selectedEmail.body || selectedEmail.snippet}
                        {/* Mocking body content with repeated snippet if body missing */}
                        {!selectedEmail.body && "\n\n(Ceci est un aperçu. Le corps complet serait chargé depuis le serveur IMAP dans une version production.)"}
                    </div>
                </div>
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 px-1">
                <div>
                    <h3 className="text-lg font-serif font-bold dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                             <Inbox size={16} />
                        </div>
                        {currentFolder === 'inbox' ? 'Boîte de réception' : currentFolder === 'sent' ? 'Éléments envoyés' : 'Brouillons'}
                    </h3>
                    <p className="text-xs font-medium text-slate-400 mt-1 ml-10">
                        {currentFolder === 'inbox' ? `${emails.filter(e => e.isUnread).length} non lus` : `${emails.length} messages`} • {clientEmail ? `Filtre: ${clientEmail}` : 'Tout'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleCompose}
                        className="p-2 bg-brand-orange text-white rounded-lg shadow-md hover:scale-105 transition-transform" 
                        title="Nouveau Message"
                    >
                        <Edit size={18} />
                    </button>
                    <button 
                        onClick={() => fetchEmails(email, password, currentFolder)} 
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" 
                        title="Actualiser"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    >
                        Déconnexion
                    </button>
                </div>
            </div>

            {/* Folder Tabs */}
            <div className="flex gap-4 px-2 mb-4 border-b border-slate-100 dark:border-slate-700">
                <button 
                    onClick={() => setCurrentFolder('inbox')}
                    className={`pb-2 text-sm font-bold transition-all border-b-2 ${currentFolder === 'inbox' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    Reçus
                </button>
                <button 
                    onClick={() => setCurrentFolder('sent')}
                    className={`pb-2 text-sm font-bold transition-all border-b-2 ${currentFolder === 'sent' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    Envoyés
                </button>
                <button 
                    onClick={() => setCurrentFolder('drafts')}
                    className={`pb-2 text-sm font-bold transition-all border-b-2 ${currentFolder === 'drafts' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    Brouillons
                </button>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 pb-4">
                {emails.map((mail) => (
                    <div 
                        key={mail.id} 
                        onClick={() => handleOpenEmail(mail)}
                        className={`
                            group relative p-5 rounded-2xl cursor-pointer transition-all duration-300
                            bg-white dark:bg-slate-800 
                            border ${mail.isUnread ? 'border-blue-400 dark:border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md'}
                        `}
                    >
                        {/* Unread Glow Indicator */}
                        {mail.isUnread && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-2xl shadow-[0_0_10px_#3b82f6]"></div>
                        )}
                        
                        <div className="flex justify-between items-start mb-2 pl-3">
                            <div className={`text-sm truncate pr-4 flex-1 ${mail.isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                                {mail.subject}
                            </div>
                            <div className={`text-[10px] whitespace-nowrap px-2 py-1 rounded-md ${mail.isUnread ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 font-bold' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 font-medium'}`}>
                                {new Date(mail.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 pl-3">
                            <User size={12} /> {mail.from.replace(/<.*?>/g, '').trim()}
                        </div>
                        
                        <p className={`text-xs line-clamp-2 leading-relaxed pl-3 pr-2 ${mail.isUnread ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            {mail.snippet}
                        </p>
                    </div>
                ))}
                
                {emails.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-60">
                        <Mail size={48} className="mb-4 text-slate-300" />
                        <p className="text-sm font-medium">Aucun email trouvé</p>
                        {clientEmail && <p className="text-xs mt-1">avec {clientEmail}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};