import React, { useState } from 'react';
import { Project, WorkflowPhase, ClientPortalComment, ClientPortalSettings } from '../types';
import { Card, Badge, Modal } from './Shared';
import { 
    Link2, 
    Copy, 
    Check, 
    Eye, 
    EyeOff, 
    MessageSquare, 
    CheckCircle, 
    Circle, 
    Clock, 
    Settings,
    ExternalLink,
    Send,
    User,
    Calendar
} from 'lucide-react';
import { WORKFLOW_CONFIG } from '../constants';

declare const confetti: any;

interface ClientPortalProps {
    project: Project;
    onUpdateProject: (project: Project) => void;
    onNotify: (title: string, message: string, type?: any) => void;
}

// Generate a unique share token
const generateShareToken = () => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
};

export const ClientPortal: React.FC<ClientPortalProps> = ({ project, onUpdateProject, onNotify }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [commentAuthor, setCommentAuthor] = useState('');
    const [copied, setCopied] = useState(false);

    // Initialize portal settings if not exists
    const portalSettings: ClientPortalSettings = project.portalSettings || {
        enabled: false,
        shareToken: generateShareToken(),
        showTasks: true,
        showTimeline: true,
        allowComments: true
    };

    const portalComments: ClientPortalComment[] = project.portalComments || [];

    // Generate shareable URL
    const portalUrl = `https://portal.marion-web.app/p/${portalSettings.shareToken}`;

    const handleTogglePortal = () => {
        const newSettings = { ...portalSettings, enabled: !portalSettings.enabled };
        if (!portalSettings.shareToken) {
            newSettings.shareToken = generateShareToken();
        }
        onUpdateProject({ ...project, portalSettings: newSettings });
        if (!portalSettings.enabled) {
            onNotify('Portail activé', `Le portail client pour ${project.clientName} est maintenant accessible.`, 'success');
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(portalUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        confetti?.({ particleCount: 20, spread: 40, origin: { y: 0.7 } });
    };

    const handleRegenerateLink = () => {
        const newSettings = { ...portalSettings, shareToken: generateShareToken() };
        onUpdateProject({ ...project, portalSettings: newSettings });
        onNotify('Lien régénéré', 'Un nouveau lien de partage a été créé.', 'info');
    };

    const handleUpdateSettings = (key: keyof ClientPortalSettings, value: any) => {
        const newSettings = { ...portalSettings, [key]: value };
        onUpdateProject({ ...project, portalSettings: newSettings });
    };

    const handleAddComment = () => {
        if (!newComment.trim() || !commentAuthor.trim()) return;
        const comment: ClientPortalComment = {
            id: `comment-${Date.now()}`,
            author: commentAuthor,
            text: newComment,
            timestamp: new Date().toISOString()
        };
        onUpdateProject({ 
            ...project, 
            portalComments: [...portalComments, comment] 
        });
        setNewComment('');
        onNotify('Commentaire ajouté', 'Votre message a été enregistré.', 'success');
    };

    const handleDeleteComment = (commentId: string) => {
        onUpdateProject({
            ...project,
            portalComments: portalComments.filter(c => c.id !== commentId)
        });
    };

    // Calculate project progress for visual display
    const PHASES = Object.values(WorkflowPhase);
    const currentPhaseIndex = PHASES.indexOf(project.phase);
    const progressPercent = ((currentPhaseIndex + 1) / PHASES.length) * 100;

    return (
        <div className="space-y-6">
            {/* Header / Enable Toggle */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Link2 size={20} className="text-brand-orange" />
                        Portail Client
                    </h3>
                    <p className="text-sm text-slate-500">Partagez l'avancement du projet avec votre client</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={handleTogglePortal}
                        className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                            portalSettings.enabled
                                ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {portalSettings.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                        {portalSettings.enabled ? 'Activé' : 'Désactivé'}
                    </button>
                </div>
            </div>

            {/* Share Link Section */}
            {portalSettings.enabled && (
                <Card className="p-4 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lien de partage</label>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
                                <input
                                    type="text"
                                    value={portalUrl}
                                    readOnly
                                    className="flex-1 bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none font-mono"
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-brand-orange transition-colors"
                                >
                                    {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleRegenerateLink}
                            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-brand-orange hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Régénérer
                        </button>
                        <a
                            href={portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors"
                        >
                            <ExternalLink size={18} />
                        </a>
                    </div>
                </Card>
            )}

            {/* Portal Preview */}
            <Card className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700">
                <div className="text-center mb-6">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Aperçu du Portail</div>
                    <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">{project.clientName}</h2>
                </div>

                {/* Progress Timeline */}
                {portalSettings.showTimeline && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-bold text-slate-500">Avancement</span>
                            <span className="text-sm font-bold text-brand-orange">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                            <div 
                                className="h-full bg-gradient-to-r from-brand-orange to-pink-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between">
                            {PHASES.map((phase, idx) => {
                                const isCompleted = idx < currentPhaseIndex;
                                const isCurrent = idx === currentPhaseIndex;
                                const config = WORKFLOW_CONFIG[phase];
                                return (
                                    <div key={phase} className="flex flex-col items-center flex-1">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                                            isCompleted ? 'bg-emerald-500 text-white' :
                                            isCurrent ? 'bg-brand-orange text-white' :
                                            'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                        }`}>
                                            {isCompleted ? <CheckCircle size={16} /> : 
                                             isCurrent ? <Clock size={16} /> : 
                                             <Circle size={16} />}
                                        </div>
                                        <span className={`text-[10px] font-bold text-center ${
                                            isCurrent ? 'text-brand-orange' : 'text-slate-400'
                                        }`}>
                                            {config?.label || phase}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tasks Overview */}
                {portalSettings.showTasks && (
                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Tâches en cours</h4>
                        <div className="space-y-2">
                            {project.tasks.filter(t => !t.completed).slice(0, 5).map(task => (
                                <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <Circle size={16} className="text-slate-400" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{task.title}</span>
                                    <Badge color={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'yellow' : 'gray'}>
                                        {task.priority}
                                    </Badge>
                                </div>
                            ))}
                            {project.tasks.filter(t => !t.completed).length === 0 && (
                                <p className="text-sm text-slate-400 italic text-center py-4">Aucune tâche en cours</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Comments Section */}
                {portalSettings.allowComments && (
                    <div>
                        <h4 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                            <MessageSquare size={14} /> Commentaires ({portalComments.length})
                        </h4>
                        
                        {/* Existing Comments */}
                        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                            {portalComments.map(comment => (
                                <div key={comment.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg group">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-brand-orange/20 rounded-full flex items-center justify-center">
                                                <User size={12} className="text-brand-orange" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{comment.author}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(comment.timestamp).toLocaleDateString()}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 pl-8">{comment.text}</p>
                                </div>
                            ))}
                            {portalComments.length === 0 && (
                                <p className="text-sm text-slate-400 italic text-center py-4">Aucun commentaire pour l'instant</p>
                            )}
                        </div>

                        {/* Add Comment */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={commentAuthor}
                                onChange={(e) => setCommentAuthor(e.target.value)}
                                placeholder="Votre nom"
                                className="w-32 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                            />
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                placeholder="Ajouter un commentaire..."
                                className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                            />
                            <button
                                onClick={handleAddComment}
                                disabled={!newComment.trim() || !commentAuthor.trim()}
                                className="p-2 bg-brand-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Settings Modal */}
            <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Paramètres du Portail" width="max-w-md">
                <div className="space-y-4 p-4">
                    <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                        <div>
                            <div className="font-bold text-sm text-slate-700 dark:text-white">Afficher les tâches</div>
                            <div className="text-xs text-slate-400">Le client voit les tâches en cours</div>
                        </div>
                        <button
                            onClick={() => handleUpdateSettings('showTasks', !portalSettings.showTasks)}
                            className={`w-12 h-6 rounded-full transition-colors ${portalSettings.showTasks ? 'bg-brand-orange' : 'bg-slate-300'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${portalSettings.showTasks ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                        <div>
                            <div className="font-bold text-sm text-slate-700 dark:text-white">Afficher la timeline</div>
                            <div className="text-xs text-slate-400">Barre de progression des phases</div>
                        </div>
                        <button
                            onClick={() => handleUpdateSettings('showTimeline', !portalSettings.showTimeline)}
                            className={`w-12 h-6 rounded-full transition-colors ${portalSettings.showTimeline ? 'bg-brand-orange' : 'bg-slate-300'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${portalSettings.showTimeline ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex justify-between items-center py-3">
                        <div>
                            <div className="font-bold text-sm text-slate-700 dark:text-white">Autoriser les commentaires</div>
                            <div className="text-xs text-slate-400">Le client peut laisser des messages</div>
                        </div>
                        <button
                            onClick={() => handleUpdateSettings('allowComments', !portalSettings.allowComments)}
                            className={`w-12 h-6 rounded-full transition-colors ${portalSettings.allowComments ? 'bg-brand-orange' : 'bg-slate-300'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${portalSettings.allowComments ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
