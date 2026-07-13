
import React, { useState } from 'react';
import { sanitizeHTML } from '../utils/sanitize';
import { Modal } from './Shared';
import { Theme } from '../types';
import {
    User, 
    Moon, 
    Sun, 
    Bell, 
    Bot, 
    Briefcase, 
    Check, 
    Sparkles, 
    CreditCard,
    Globe,
    Zap,
    Volume2,
    Eye,
    Rainbow,
    Star,
    Code,
    Type,
    Cloud,
    HardDrive,
    RefreshCw,
    FolderSync,
    ExternalLink,
    AlertCircle,
    Download,
    Package,
    CheckCircle,
    Loader2,
    ArrowUpCircle,
    FileText,
    Copy,
    Clock,
    Shield,
    Lock,
    LogOut,
    Key,
    Upload,
    CloudUpload,
    Telescope,
    EyeOff,
    Trash2,
    Mail,
} from 'lucide-react';
import {
    useOAuthStatus,
    useVersion,
    useCheckUpdates,
    useApplyUpdate,
    useConnectGoogle,
    useDisconnectGoogle,
    useCloudBackupConfig,
    useSetCloudBackupConfig,
    useCloudBackup,
    useBackupStatus,
    useManualLocalBackup,
    useDownloadBackupBundle,
    useCheckStatus,
    queryKeys,
    useClientWorkspacePaths,
    useClientDataPathSetting,
    useSetClientDataPath,
    clientPathsFromVersionPayload,
    type ClientWorkspacePaths,
} from '../services/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores';
import { apiFetch } from '../services/api';

/** Helps spot “git pull dans un dossier, mais Marion lance un autre” (icone Bureau ou vieux dossier). */
function ServerInstallDiagnostic({ payload }: { payload: unknown }) {
    if (!payload || typeof payload !== 'object') return null;
    const o = payload as Record<string, unknown>;
    const ver = typeof o.version === 'string' ? o.version : null;
    const root = typeof o.appInstallationRoot === 'string' ? o.appInstallationRoot : null;
    const dist = typeof o.staticFolderResolved === 'string' ? o.staticFolderResolved : null;
    const built = typeof o.settingsBundleBuiltAt === 'string' ? o.settingsBundleBuiltAt : null;
    if (!root && !dist) return null;

    return (
        <div className="mt-4 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/30">
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide mb-2">
                Où Marion tourne réellement sur ton Mac
            </div>
            <p className="text-xs text-amber-900/90 dark:text-amber-100/95 mb-3 leading-relaxed">
                Compare ces chemins avec le dossier dans lequel tu as fait{' '}
                <span className="font-mono">git pull</span> et{' '}
                <span className="font-mono">npm run build</span>. S’ils ne sont{' '}
                <strong>pas identiques</strong>, tu ouvres une <strong>ancienne copie</strong> pendant que tu modifies une
                autre (souvent l’icône <strong>Bureau « Eonora Tech OS »</strong> pointait vers un chemin lors de{' '}
                <span className="font-mono">INSTALLER.command</span> — il faut relancer l’app depuis{' '}
                <strong>le bon dossier</strong> ou revoir cet installateur.)
            </p>
            <ul className="text-[11px] font-mono text-amber-950 dark:text-amber-50 space-y-1.5 break-all">
                {ver ? (
                    <li>
                        <span className="text-amber-800/80 dark:text-amber-300">Version renvoyée par le serveur :</span> v
                        {ver}
                    </li>
                ) : null}
                {root ? (
                    <li>
                        <span className="text-amber-800/80 dark:text-amber-300">Racine code Python Marion :</span> {root}
                    </li>
                ) : null}
                {dist ? (
                    <li>
                        <span className="text-amber-800/80 dark:text-amber-300">Interface chargée depuis (.dist) :</span> {dist}
                    </li>
                ) : null}
                {built ? (
                    <li>
                        <span className="text-amber-800/80 dark:text-amber-300">Dernière compil. écran Réglages (fichier) :</span>{' '}
                        {built}
                    </li>
                ) : null}
            </ul>
        </div>
    );
}

function LocalClientFoldersCard({
    paths,
    loading,
    pathCopied,
    onCopyPath,
    onCopyDefaultPathHint,
    fallbackNote,
}: {
    paths: ClientWorkspacePaths | null;
    loading: boolean;
    pathCopied: boolean;
    onCopyPath: () => void;
    /** When server path is unavailable, copy the usual default location. */
    onCopyDefaultPathHint: () => void;
    fallbackNote?: string | null;
}) {
    return (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
            <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <FolderSync size={18} className="text-indigo-500" />
                Dossiers clients (disque local)
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Marion lit vos projets dans les sous-dossiers de ce répertoire (
                <span className="font-medium">1. En cours</span>, <span className="font-medium">4. Prospects</span>,
                etc.). Si le tableau de bord ne liste pas vos clients, ouvre ce dossier dans le Finder et vérifie
                que tes projets s’y trouvent (pas une ancienne copie du dossier « Eonora Tech OS Database »). Tu peux aussi
                fixer le chemin via <span className="font-mono text-xs">DATA_PATH</span> dans{' '}
                <span className="font-mono text-xs">.env.local</span> (ou via le formulaire ci-dessous),
                puis redémarrer l’application.
            </p>
            {fallbackNote ? (
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-3 p-3 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
                    {fallbackNote}
                </p>
            ) : null}
            {loading && !paths ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin" /> Chargement…
                </div>
            ) : paths ? (
                <>
                    {!paths.clientDataPathExists && (
                        <div className="flex items-start gap-2 p-3 mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            Ce dossier n’existe pas ou n’est pas accessible. Créez-le ou corrigez DATA_PATH.
                        </div>
                    )}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-xs font-mono break-all text-slate-700 dark:text-slate-200 mb-3">
                        {paths.clientDataPath}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase">
                            Dossiers détectés : {paths.clientFolderCount < 0 ? '—' : paths.clientFolderCount}
                        </span>
                    </div>
                    {paths.sqliteDatabasePath ? (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
                            Base SQLite :{' '}
                            <span className="font-mono break-all">{paths.sqliteDatabasePath}</span>
                        </p>
                    ) : null}
                    <button
                        type="button"
                        onClick={onCopyPath}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                        {pathCopied ? <Check size={16} /> : <Copy size={16} />}
                        {pathCopied ? 'Copié' : 'Copier le chemin'}
                    </button>
                </>
            ) : (
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                    <p>
                        Marion n’a pas pu lire le chemin exact depuis le serveur (connexion, cache du navigateur, ou
                        backend pas redémarré après mise à jour). Recharge la page avec{' '}
                        <span className="font-mono text-xs">Cmd + Shift + R</span>, puis redémarre l’app Python si besoin.
                    </p>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                            Emplacement habituel sur Mac (si tu n’as rien changé)
                        </div>
                        <code className="font-mono text-xs text-slate-800 dark:text-slate-100 break-all block">
                            ~/Desktop/Eonora Tech OS Database
                        </code>
                        <p className="text-xs text-slate-500 mt-2">
                            Dans le Finder :{' '}
                            <span className="font-mono text-[11px]">Cmd + Shift + G</span> et colle cette ligne ou
                            navigue jusqu’à ton <strong>Bureau</strong>.
                        </p>
                        <button
                            type="button"
                            onClick={onCopyDefaultPathHint}
                            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-medium rounded-lg"
                        >
                            {pathCopied ? <Check size={14} /> : <Copy size={14} />}
                            {pathCopied ? 'Copié' : 'Copier le chemin par défaut'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ClientDataPathSettingCard({ isOpen }: { isOpen: boolean }) {
    const { data, isPending } = useClientDataPathSetting(isOpen);
    const setPathMut = useSetClientDataPath();
    const [draft, setDraft] = useState('');
    const [dirty, setDirty] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    React.useEffect(() => {
        if (!data || dirty) return;
        setDraft(data.savedResolved ?? data.savedRaw ?? '');
    }, [data, dirty]);

    const save = () => {
        setFeedback(null);
        setPathMut.mutate(
            { path: draft },
            {
                onSuccess: (res) => {
                    setDirty(false);
                    setFeedback({ type: 'ok', text: res.message ?? 'Enregistré dans .env.local.' });
                },
                onError: (e: Error) => setFeedback({ type: 'err', text: e.message }),
            },
        );
    };

    const resetDefault = () => {
        setFeedback(null);
        setPathMut.mutate(
            { reset: true },
            {
                onSuccess: (res) => {
                    setDirty(false);
                    setDraft('');
                    setFeedback({ type: 'ok', text: res.message ?? 'Réinitialisé.' });
                },
                onError: (e: Error) => setFeedback({ type: 'err', text: e.message }),
            },
        );
    };

    const busy = setPathMut.isPending;

    return (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <FolderSync size={18} className="text-emerald-600 dark:text-emerald-400" />
                Dossier données (prochain démarrage)
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Indique le chemin absolu du dossier « Eonora Tech OS Database » (ou équivalent). Marion écrit la ligne{' '}
                <span className="font-mono text-xs">DATA_PATH</span> dans le fichier{' '}
                <span className="font-mono text-xs">.env.local</span> à la racine du code Python — pas besoin d’ouvrir ce
                fichier à la main.
            </p>
            {data ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3 font-mono break-all">
                    Fichier : {data.envLocalAbsolute}
                </p>
            ) : null}
            {isPending && !data ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <Loader2 size={16} className="animate-spin" /> Chargement…
                </div>
            ) : null}
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">Chemin du dossier clients</label>
            <input
                type="text"
                value={draft}
                onChange={(e) => {
                    setDirty(true);
                    setDraft(e.target.value);
                }}
                placeholder={data?.effectiveNow ?? '/Users/…/Eonora Tech OS Database'}
                disabled={busy}
                className="w-full px-4 py-2.5 mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-emerald-500 text-sm font-mono text-slate-800 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                En cours d’exécution, Marion utilise encore :{' '}
                <span className="font-mono break-all text-slate-700 dark:text-slate-200">
                    {data?.effectiveNow ?? '—'}
                </span>
                . {data?.restartRequiredHint ?? 'Après modification, redémarre le serveur Python pour appliquer.'}
            </p>
            {feedback ? (
                <div
                    className={`text-sm mb-3 p-3 rounded-xl border ${
                        feedback.type === 'ok'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
                    }`}
                >
                    {feedback.text}
                </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={save}
                    disabled={busy || !draft.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Enregistrer dans .env.local
                </button>
                <button
                    type="button"
                    onClick={resetDefault}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-medium rounded-xl transition-colors"
                >
                    Revenir au défaut
                </button>
            </div>
        </div>
    );
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTheme: Theme;
    onThemeChange: (theme: Theme) => void;
    currency: string;
    onCurrencyChange: (currency: string) => void;
    accentColor: string;
    onAccentColorChange: (color: string) => void;
    
    // New Props for Persistence
    agencyName: string;
    setAgencyName: (name: string) => void;
    agencyWebsite: string;
    setAgencyWebsite: (website: string) => void;
    tjh: string;
    setTjh: (tjh: string) => void;
    aiTone: string;
    setAiTone: (tone: string) => void;
    briefingVocal: boolean;
    setBriefingVocal: (enabled: boolean) => void;
    aiMode: 'local' | 'hybrid' | 'cloud';
    setAiMode: (mode: 'local' | 'hybrid' | 'cloud') => void;
    localModelName: string;
    setLocalModelName: (name: string) => void;
    aiFallbackEnabled: boolean;
    setAiFallbackEnabled: (enabled: boolean) => void;
    signatureSettings: any;
    setSignatureSettings: (settings: any) => void;
    notificationSettings: any[];
    setNotificationSettings: (settings: any[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, 
    currentTheme, onThemeChange, 
    currency, onCurrencyChange, 
    accentColor, onAccentColorChange,
    agencyName, setAgencyName,
    agencyWebsite, setAgencyWebsite,
    tjh, setTjh,
    aiTone, setAiTone,
    briefingVocal, setBriefingVocal,
    aiMode, setAiMode,
    localModelName, setLocalModelName,
    aiFallbackEnabled, setAiFallbackEnabled,
    signatureSettings, setSignatureSettings,
    notificationSettings, setNotificationSettings
}) => {
    const [activeTab, setActiveTab] = useState<
        'agency' | 'appearance' | 'ai' | 'notifications' | 'cloud' | 'localData' | 'security' | 'updates'
    >('agency');
    const [pathCopied, setPathCopied] = useState(false);
    
    // Subscription date from store
    const subscriptionDate = useUIStore(s => s.subscriptionDate);
    const renewalDate = React.useMemo(() => {
        try {
            const start = new Date(subscriptionDate);
            start.setFullYear(start.getFullYear() + 1);
            return start.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return '--';
        }
    }, [subscriptionDate]);

    // Cloud Storage State
    const [cloudConfig, setCloudConfig] = useState(() => {
        const saved = localStorage.getItem('marion_cloud_config');
        return saved ? JSON.parse(saved) : {
            googleDrive: { enabled: false, connected: false, folder: '', email: '', name: '' },
            dropbox: { enabled: false, connected: false, folder: '' },
            autoSync: false,
            syncInterval: 30 // minutes
        };
    });
    const [isConnecting, setIsConnecting] = useState(false);

    // React Query hooks
    const queryClient = useQueryClient();
    const { data: oauthData } = useOAuthStatus();
    const connectGoogleMutation = useConnectGoogle();
    const disconnectGoogleMutation = useDisconnectGoogle();
    const isAiTabOpen = isOpen && activeTab === 'ai';
    const {
        data: aiHealth,
        isLoading: isAiHealthLoading,
        refetch: refetchAiHealth,
    } = useCheckStatus(isAiTabOpen, {
        ai_mode: aiMode,
        local_model: localModelName,
        fallback_enabled: aiFallbackEnabled,
    });

    // Apollo.io key management
    const [apolloKey, setApolloKey] = useState('');
    const [apolloKeyVisible, setApolloKeyVisible] = useState(false);
    const [apolloStatus, setApolloStatus] = useState<{ configured: boolean; available: boolean } | null>(null);
    const [apolloSaving, setApolloSaving] = useState(false);
    const [apolloMessage, setApolloMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Hunter.io key management
    const [hunterKey, setHunterKey] = useState('');
    const [hunterKeyVisible, setHunterKeyVisible] = useState(false);
    const [hunterConfigured, setHunterConfigured] = useState(false);
    const [hunterSaving, setHunterSaving] = useState(false);
    const [hunterMessage, setHunterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Claude (Anthropic) key management
    const [claudeKey, setClaudeKey] = useState('');
    const [claudeKeyVisible, setClaudeKeyVisible] = useState(false);
    const [claudeConfigured, setClaudeConfigured] = useState(false);
    const [claudeSaving, setClaudeSaving] = useState(false);
    const [claudeMessage, setClaudeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Gemini (Google) key management — persisted in DB so it survives reloads / reinstalls
    const [geminiKey, setGeminiKey] = useState('');
    const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
    const [geminiConfigured, setGeminiConfigured] = useState(false);
    const [geminiSaving, setGeminiSaving] = useState(false);
    const [geminiMessage, setGeminiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Load Apollo + Hunter + Claude + Gemini status when AI tab opens
    React.useEffect(() => {
        if (!isAiTabOpen) return;
        apiFetch('/api/v1/prospection/status')
            .then(r => r.json())
            .then(data => {
                setApolloStatus({ configured: data.apollo_configured, available: data.apollo_available });
                setHunterConfigured(!!data.hunter_configured);
            })
            .catch(() => {});
        apiFetch('/api/v1/ai/claude/status')
            .then(r => r.json())
            .then(data => setClaudeConfigured(!!data.configured))
            .catch(() => {});
        apiFetch('/api/v1/ai/gemini/status')
            .then(r => r.json())
            .then(data => setGeminiConfigured(!!data.configured))
            .catch(() => {});
    }, [isAiTabOpen]);

    const handleSaveGeminiKey = async () => {
        if (!geminiKey.trim()) return;
        setGeminiSaving(true);
        setGeminiMessage(null);
        try {
            const res = await apiFetch('/api/v1/ai/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: geminiKey.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setGeminiMessage({ type: 'success', text: 'Clé Gemini enregistrée et validée. Elle est sauvegardée durablement.' });
                setGeminiConfigured(true);
                setGeminiKey('');
                refetchAiHealth();
            } else {
                setGeminiMessage({ type: 'error', text: data.error || 'Clé invalide' });
            }
        } catch {
            setGeminiMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setGeminiSaving(false);
        }
    };

    const handleRemoveGeminiKey = async () => {
        setGeminiSaving(true);
        setGeminiMessage(null);
        try {
            const res = await apiFetch('/api/v1/ai/setup', { method: 'DELETE' });
            if (res.ok) {
                setGeminiMessage({ type: 'success', text: 'Clé Gemini supprimée.' });
                setGeminiConfigured(false);
                setGeminiKey('');
                refetchAiHealth();
            } else {
                setGeminiMessage({ type: 'error', text: 'Suppression impossible.' });
            }
        } catch {
            setGeminiMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setGeminiSaving(false);
        }
    };

    const handleSaveClaudeKey = async () => {
        if (!claudeKey.trim()) return;
        setClaudeSaving(true);
        setClaudeMessage(null);
        try {
            const res = await apiFetch('/api/v1/ai/claude/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: claudeKey.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setClaudeMessage({ type: 'success', text: 'Clé Claude enregistrée et validée !' });
                setClaudeConfigured(true);
                setClaudeKey('');
            } else {
                setClaudeMessage({ type: 'error', text: data.error || 'Erreur inconnue' });
            }
        } catch {
            setClaudeMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setClaudeSaving(false);
        }
    };

    const handleRemoveClaudeKey = async () => {
        setClaudeSaving(true);
        setClaudeMessage(null);
        try {
            const res = await apiFetch('/api/v1/ai/claude/setup', { method: 'DELETE' });
            if (res.ok) {
                setClaudeMessage({ type: 'success', text: 'Clé Claude supprimée.' });
                setClaudeConfigured(false);
                setClaudeKey('');
            }
        } catch {
            setClaudeMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setClaudeSaving(false);
        }
    };

    const handleSaveApolloKey = async () => {
        if (!apolloKey.trim()) return;
        setApolloSaving(true);
        setApolloMessage(null);
        try {
            const res = await apiFetch('/api/v1/prospection/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apolloKey.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setApolloMessage({ type: 'success', text: 'Clé Apollo.io enregistrée et validée !' });
                setApolloStatus({ configured: true, available: true });
                setApolloKey('');
            } else {
                setApolloMessage({ type: 'error', text: data.error || 'Erreur inconnue' });
            }
        } catch {
            setApolloMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setApolloSaving(false);
        }
    };

    const handleRemoveApolloKey = async () => {
        setApolloSaving(true);
        setApolloMessage(null);
        try {
            const res = await apiFetch('/api/v1/prospection/setup', { method: 'DELETE' });
            if (res.ok) {
                setApolloMessage({ type: 'success', text: 'Clé Apollo.io supprimée.' });
                setApolloStatus({ configured: false, available: false });
                setApolloKey('');
            }
        } catch {
            setApolloMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setApolloSaving(false);
        }
    };

    const handleSaveHunterKey = async () => {
        if (!hunterKey.trim()) return;
        setHunterSaving(true);
        setHunterMessage(null);
        try {
            const res = await apiFetch('/api/v1/prospection/hunter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: hunterKey.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setHunterMessage({ type: 'success', text: 'Clé Hunter.io enregistrée !' });
                setHunterConfigured(true);
                setHunterKey('');
            } else {
                setHunterMessage({ type: 'error', text: data.error || 'Erreur inconnue' });
            }
        } catch {
            setHunterMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setHunterSaving(false);
        }
    };

    const handleRemoveHunterKey = async () => {
        setHunterSaving(true);
        setHunterMessage(null);
        try {
            const res = await apiFetch('/api/v1/prospection/hunter', { method: 'DELETE' });
            if (res.ok) {
                setHunterMessage({ type: 'success', text: 'Clé Hunter.io supprimée.' });
                setHunterConfigured(false);
                setHunterKey('');
            }
        } catch {
            setHunterMessage({ type: 'error', text: 'Impossible de joindre le serveur' });
        } finally {
            setHunterSaving(false);
        }
    };

    // Cloud backup hooks (fetch local + cloud status whenever Cloud tab is open)
    const { data: cloudBackupConfig } = useCloudBackupConfig();
    const { data: backupStatus, refetch: refetchBackupStatus } = useBackupStatus(isOpen && activeTab === 'cloud');
    const setCloudBackupConfigMutation = useSetCloudBackupConfig();
    const cloudBackupMutation = useCloudBackup();
    const manualLocalBackupMutation = useManualLocalBackup();
    const downloadBundleMutation = useDownloadBackupBundle();
    const isCloudBackupEnabled = cloudBackupConfig?.cloudBackupEnabled ?? false;

    // Sync OAuth status from React Query into local cloud config
    React.useEffect(() => {
        if (oauthData?.connected) {
            const updated = {
                ...cloudConfig,
                googleDrive: { 
                    ...cloudConfig.googleDrive, 
                    connected: true, 
                    enabled: true,
                    email: oauthData.email,
                    name: oauthData.name
                }
            };
            setCloudConfig(updated);
            localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
        }
    }, [oauthData]);

    const handleCloudConfigChange = (provider: 'googleDrive' | 'dropbox', key: string, value: any) => {
        const updated = {
            ...cloudConfig,
            [provider]: { ...cloudConfig[provider], [key]: value }
        };
        setCloudConfig(updated);
        localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
    };

    const handleConnectGoogle = async () => {
        setIsConnecting(true);
        connectGoogleMutation.mutate(undefined, {
            onSuccess: (data) => {
                // Open popup for OAuth
                const popup = window.open(data.auth_url, 'Google Auth', 'width=500,height=600,left=200,top=100');
                
                // Listen for messages from popup
                const handleMessage = (event: MessageEvent) => {
                    if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                        const updated = {
                            ...cloudConfig,
                            googleDrive: { 
                                ...cloudConfig.googleDrive, 
                                connected: true, 
                                enabled: true,
                                email: event.data.email,
                                name: event.data.name
                            }
                        };
                        setCloudConfig(updated);
                        localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
                        // Refresh calendar & OAuth queries so Agenda picks up the new connection
                        queryClient.invalidateQueries({ queryKey: queryKeys.calendarSync });
                        queryClient.invalidateQueries({ queryKey: queryKeys.events });
                        queryClient.invalidateQueries({ queryKey: queryKeys.oauthStatus });
                        setIsConnecting(false);
                        window.removeEventListener('message', handleMessage);
                    } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
                        console.error('Google Auth Error:', event.data.error);
                        setIsConnecting(false);
                        window.removeEventListener('message', handleMessage);
                    }
                };
                
                window.addEventListener('message', handleMessage);
                
                // Check if popup was closed without completing
                const checkClosed = setInterval(() => {
                    if (popup?.closed) {
                        clearInterval(checkClosed);
                        setIsConnecting(false);
                        window.removeEventListener('message', handleMessage);
                    }
                }, 1000);
            },
            onError: (e) => {
                console.error('Failed to initiate Google OAuth', e);
                setIsConnecting(false);
            },
        });
    };

    const handleDisconnectGoogle = async () => {
        disconnectGoogleMutation.mutate(undefined, {
            onSuccess: () => {
                const updated = {
                    ...cloudConfig,
                    googleDrive: { enabled: false, connected: false, folder: '', email: '', name: '' }
                };
                setCloudConfig(updated);
                localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
                
                // Refresh calendar & OAuth queries so Agenda updates immediately
                queryClient.invalidateQueries({ queryKey: queryKeys.calendarSync });
                queryClient.invalidateQueries({ queryKey: queryKeys.events });
                queryClient.invalidateQueries({ queryKey: queryKeys.oauthStatus });
                // Notify other components (like Agenda) of disconnect
                window.postMessage({ type: 'GOOGLE_AUTH_DISCONNECT' }, '*');
            },
            onError: (e) => {
                console.error('Failed to disconnect Google', e);
            },
        });
    };

    const handleConnectCloud = async (provider: 'googleDrive' | 'dropbox') => {
        if (provider === 'googleDrive') {
            handleConnectGoogle();
        } else {
            // Dropbox - placeholder for now
            const updated = {
                ...cloudConfig,
                [provider]: { ...cloudConfig[provider], connected: true, enabled: true }
            };
            setCloudConfig(updated);
            localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
        }
    };

    const handleDisconnectCloud = (provider: 'googleDrive' | 'dropbox') => {
        if (provider === 'googleDrive') {
            handleDisconnectGoogle();
        } else {
            const updated = {
                ...cloudConfig,
                [provider]: { enabled: false, connected: false, folder: '' }
            };
            setCloudConfig(updated);
            localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
        }
    };
    const [isSaving, setIsSaving] = useState(false);

    // Local State for "Batch Save" behavior (initialized from props)
    const [localAgencyName, setLocalAgencyName] = useState(agencyName);
    const [localAgencyWebsite, setLocalAgencyWebsite] = useState(agencyWebsite);
    const [localTjh, setLocalTjh] = useState(tjh);
    const [localCurrency, setLocalCurrency] = useState(currency);
    // Mentions légales suisses (CO, LTVA) — persistées via useUIStore.
    const agencyIde = useUIStore(s => s.agencyIde);
    const agencyVatNumber = useUIStore(s => s.agencyVatNumber);
    const agencyReminderFees = useUIStore(s => s.agencyReminderFees);
    const defaultVatRate = useUIStore(s => s.defaultVatRate);
    const setAgencyIde = useUIStore(s => s.setAgencyIde);
    const setAgencyVatNumber = useUIStore(s => s.setAgencyVatNumber);
    const setAgencyReminderFees = useUIStore(s => s.setAgencyReminderFees);
    const setDefaultVatRate = useUIStore(s => s.setDefaultVatRate);
    const [localIde, setLocalIde] = useState(agencyIde);
    const [localVatNumber, setLocalVatNumber] = useState(agencyVatNumber);
    const [localReminderFees, setLocalReminderFees] = useState<[number, number, number]>(agencyReminderFees);
    const [localDefaultVat, setLocalDefaultVat] = useState<0 | 2.6 | 3.8 | 8.1>(defaultVatRate);
    const [localAiTone, setLocalAiTone] = useState(aiTone);
    const [localBriefingVocal, setLocalBriefingVocal] = useState(briefingVocal);
    const [localAiMode, setLocalAiMode] = useState(aiMode);
    const [localAiModelName, setLocalModelNameState] = useState(localModelName);
    const [localAiFallbackEnabled, setLocalAiFallbackEnabledState] = useState(aiFallbackEnabled);
    const [localSignature, setLocalSignature] = useState(signatureSettings);
    const [localNotifications, setLocalNotifications] = useState(notificationSettings);

    // Sync local state when modal opens (props change)
    React.useEffect(() => {
        if (isOpen) {
            setLocalAgencyName(agencyName);
            setLocalAgencyWebsite(agencyWebsite);
            setLocalTjh(tjh);
            setLocalCurrency(currency);
            setLocalIde(agencyIde);
            setLocalVatNumber(agencyVatNumber);
            setLocalReminderFees(agencyReminderFees);
            setLocalDefaultVat(defaultVatRate);
            setLocalAiTone(aiTone);
            setLocalBriefingVocal(briefingVocal);
            setLocalAiMode(aiMode);
            setLocalModelNameState(localModelName);
            setLocalAiFallbackEnabledState(aiFallbackEnabled);
            setLocalSignature(signatureSettings);
            setLocalNotifications(notificationSettings);
        }
    }, [isOpen, agencyName, agencyWebsite, tjh, currency, agencyIde, agencyVatNumber, agencyReminderFees, defaultVatRate, aiTone, briefingVocal, aiMode, localModelName, aiFallbackEnabled, signatureSettings, notificationSettings]);
    
    // Helper for signature updates
    const updateLocalSignature = (key: string, value: string) => {
        setLocalSignature({ ...localSignature, [key]: value });
    };

    const handleSave = () => {
        setIsSaving(true);
        // Commit local state to parent state (and thus localStorage via zustand store)
        setAgencyName(localAgencyName);
        setAgencyWebsite(localAgencyWebsite);
        setTjh(localTjh);
        onCurrencyChange(localCurrency);
        setAgencyIde(localIde.trim());
        setAgencyVatNumber(localVatNumber.trim());
        setAgencyReminderFees(localReminderFees);
        setDefaultVatRate(localDefaultVat);
        setAiTone(localAiTone);
        setBriefingVocal(localBriefingVocal);
        setAiMode(localAiMode);
        setLocalModelName(localAiModelName);
        setAiFallbackEnabled(localAiFallbackEnabled);
        setSignatureSettings(localSignature);
        setNotificationSettings(localNotifications);

        setTimeout(() => {
            setIsSaving(false);
            onClose();
        }, 500); 
    };

    // Update state
    const [updateInfo, setUpdateInfo] = useState<{
        currentVersion: string;
        latestVersion?: string;
        updateAvailable?: boolean;
        commitsBehind?: boolean;
        localCommit?: string | null;
        remoteCommit?: string | null;
        releaseNotes?: string;
        releaseName?: string;
        publishedAt?: string;
        htmlUrl?: string;
        message?: string;
        error?: string;
    } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateMessage, setUpdateMessage] = useState<string | null>(null);

    // React Query hooks for version & updates
    const { data: versionData, isFetching: versionFetching } = useVersion(isOpen);
    const { data: workspacePaths, isFetching: workspacePathsFetching } = useClientWorkspacePaths(isOpen);
    const pathsFromVersion = React.useMemo(
        () => clientPathsFromVersionPayload(versionData),
        [versionData]
    );
    const mergedLocalPaths: ClientWorkspacePaths | null =
        workspacePaths ?? pathsFromVersion ?? null;
    const localPathsLoading =
        mergedLocalPaths === null &&
        (workspacePathsFetching || (versionFetching && !versionData));
    const pathsFallbackNote =
        mergedLocalPaths && !workspacePaths
            ? 'Ces infos viennent du serveur (réponse publique « version ») : ça évite une erreur si l’API « workspace » nécessite une session différente. Le chemin est bien celui que Marion utilise pour scanner les dossiers sur ce Mac.'
            : null;

    const handleCopyDataPath = () => {
        const p = mergedLocalPaths?.clientDataPath;
        if (!p) return;
        void navigator.clipboard.writeText(p).then(() => {
            setPathCopied(true);
            window.setTimeout(() => setPathCopied(false), 2000);
        });
    };

    const handleCopyDefaultDataPathHint = () => {
        void navigator.clipboard.writeText('~/Desktop/Eonora Tech OS Database').then(() => {
            setPathCopied(true);
            window.setTimeout(() => setPathCopied(false), 2000);
        });
    };

    const checkUpdatesMutation = useCheckUpdates();
    const applyUpdateMutation = useApplyUpdate();

    // Sync version data from React Query
    React.useEffect(() => {
        if (versionData?.version && !updateInfo) {
            setUpdateInfo({ currentVersion: versionData.version });
        }
    }, [versionData]);

    const isCheckingUpdate = checkUpdatesMutation.isPending;

    const checkForUpdates = () => {
        setUpdateMessage(null);
        checkUpdatesMutation.mutate(undefined, {
            onSuccess: (data) => {
                setUpdateInfo(data);
            },
            onError: () => {
                setUpdateInfo({ currentVersion: updateInfo?.currentVersion || 'Inconnu', error: 'Impossible de vérifier les mises à jour' });
            },
        });
    };

    const applyUpdate = () => {
        setIsUpdating(true);
        setUpdateMessage(null);
        applyUpdateMutation.mutate(undefined, {
            onSuccess: (data) => {
                if (data.success) {
                    setUpdateMessage(data.instruction || 'Mise à jour lancée ! Suivez les instructions dans le terminal.');
                } else {
                    setUpdateMessage(data.error || 'Erreur lors de la mise à jour');
                }
            },
            onError: () => {
                setUpdateMessage('Erreur de connexion au serveur');
            },
            onSettled: () => {
                setIsUpdating(false);
            },
        });
    };

    // Vérification automatique à l'ouverture de l'onglet Mises à jour
    React.useEffect(() => {
        if (activeTab !== 'updates') return;
        if (checkUpdatesMutation.isPending || checkUpdatesMutation.isSuccess) return;
        checkForUpdates();
    }, [activeTab]);

    const tabs = [
        { id: 'agency', label: 'Agence & Profil', icon: Briefcase },
        { id: 'appearance', label: 'Apparence', icon: Eye },
        { id: 'ai', label: 'IA & Assistant', icon: Bot },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'cloud', label: 'Cloud & Sync', icon: Cloud },
        { id: 'localData', label: 'Données locales', icon: HardDrive },
        { id: 'security', label: 'Sécurité', icon: Lock },
        { id: 'updates', label: 'Mises à jour', icon: Download },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Paramètres de l'Agence" width="max-w-4xl">
            <div className="flex flex-col md:flex-row">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-100 dark:border-slate-700 p-4 flex flex-col gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${
                                activeTab === tab.id 
                                ? 'bg-white dark:bg-slate-700 text-brand-orange shadow-sm shadow-orange-100 dark:shadow-none' 
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                    
                    <div className="mt-auto p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/20">
                        <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">Abonnement Pro</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Renouvellement le {renewalDate}</div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 md:p-8 bg-white dark:bg-slate-900">
                    
                    {/* AGENCY TAB */}
                    {activeTab === 'agency' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h3 className="text-xl font-serif text-slate-800 dark:text-white mb-6">Identité de l'Agence</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Nom de l'agence</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input 
                                            value={localAgencyName}
                                            onChange={(e) => setLocalAgencyName(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Site Web</label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input 
                                            value={localAgencyWebsite}
                                            onChange={(e) => setLocalAgencyWebsite(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">TJH ({localCurrency}/heure)</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input 
                                            type="number"
                                            value={localTjh}
                                            onChange={(e) => setLocalTjh(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400">Utilisé pour estimer automatiquement les devis et calculer le temps facturable.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Devise</label>
                                    <select 
                                        value={localCurrency}
                                        onChange={(e) => setLocalCurrency(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors cursor-pointer"
                                    >
                                        <option value="CHF">CHF (Franc Suisse)</option>
                                        <option value="€">EUR (Euro)</option>
                                        <option value="$">USD (Dollar)</option>
                                        <option value="£">GBP (Livre Sterling)</option>
                                    </select>
                                </div>
                            </div>

                            {/* --- Mentions légales suisses --- */}
                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
                                    Mentions légales suisses
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">N° IDE / UID</label>
                                        <input
                                            value={localIde}
                                            onChange={(e) => setLocalIde(e.target.value)}
                                            placeholder="CHE-265.310.079"
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors font-mono text-sm"
                                        />
                                        <p className="text-[10px] text-slate-400">Affiché en pied de facture (obligatoire pour entité enregistrée au RC).</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">N° TVA</label>
                                        <input
                                            value={localVatNumber}
                                            onChange={(e) => setLocalVatNumber(e.target.value)}
                                            placeholder="CHE-265.310.079 TVA"
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors font-mono text-sm"
                                        />
                                        <p className="text-[10px] text-slate-400">Obligatoire si CA &gt; 100'000 CHF. Laisser vide si non-assujettie.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Taux TVA par défaut</label>
                                        <select
                                            value={String(localDefaultVat)}
                                            onChange={(e) => setLocalDefaultVat(Number(e.target.value) as 0 | 2.6 | 3.8 | 8.1)}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors cursor-pointer"
                                        >
                                            <option value="0">0 % — Pas de TVA / Exonérée</option>
                                            <option value="2.6">2.6 % — Taux réduit</option>
                                            <option value="3.8">3.8 % — Hébergement</option>
                                            <option value="8.1">8.1 % — Taux normal</option>
                                        </select>
                                        <p className="text-[10px] text-slate-400">Appliqué aux nouvelles lignes de facture.</p>
                                    </div>
                                </div>
                            </div>

                            {/* --- Frais de relance --- */}
                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Frais de relance (CHF)
                                </h4>
                                <p className="text-[11px] text-slate-400 mb-4">Ajoutés à la facture lors de l'envoi de la relance correspondante.</p>
                                <div className="grid grid-cols-3 gap-4">
                                    {(['1', '2', '3'] as const).map((lvl, idx) => (
                                        <div key={lvl} className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Relance n° {lvl}</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="5"
                                                value={localReminderFees[idx]}
                                                onChange={(e) => {
                                                    const next = [...localReminderFees] as [number, number, number];
                                                    next[idx] = Number(e.target.value) || 0;
                                                    setLocalReminderFees(next);
                                                }}
                                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-orange transition-colors tabular-nums"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Signature Email</h4>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                        <button 
                                            onClick={() => updateLocalSignature('mode', 'standard')}
                                            className={`p-1.5 rounded-md transition-all ${localSignature.mode === 'standard' ? 'bg-white dark:bg-slate-700 shadow text-brand-orange' : 'text-slate-400'}`}
                                            title="Standard"
                                        >
                                            <Type size={14} />
                                        </button>
                                        <button 
                                            onClick={() => updateLocalSignature('mode', 'html')}
                                            className={`p-1.5 rounded-md transition-all ${localSignature.mode === 'html' ? 'bg-white dark:bg-slate-700 shadow text-brand-orange' : 'text-slate-400'}`}
                                            title="HTML Custom"
                                        >
                                            <Code size={14} />
                                        </button>
                                    </div>
                                </div>

                                {localSignature.mode === 'standard' ? (
                                    <div className="space-y-4 mb-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <input 
                                                placeholder="Nom"
                                                value={localSignature.name}
                                                onChange={(e) => updateLocalSignature('name', e.target.value)}
                                                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange dark:text-white"
                                            />
                                            <input 
                                                placeholder="Rôle"
                                                value={localSignature.role}
                                                onChange={(e) => updateLocalSignature('role', e.target.value)}
                                                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange dark:text-white"
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div 
                                                onClick={() => document.getElementById('logo-upload')?.click()}
                                                className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-brand-orange hover:text-brand-orange text-slate-400 transition-colors bg-slate-50 dark:bg-slate-800 shrink-0 overflow-hidden"
                                            >
                                                {localSignature.imageUrl ? (
                                                    <img src={localSignature.imageUrl} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs font-bold">+</span>
                                                        <span className="text-[8px] uppercase">Logo</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-slate-500 mb-2">Cliquez sur le carré pour importer votre logo ou photo (max 500ko conseillé).</p>
                                                {localSignature.imageUrl && (
                                                    <button 
                                                        onClick={() => updateLocalSignature('imageUrl', '')}
                                                        className="text-xs text-red-500 hover:underline"
                                                    >
                                                        Supprimer l'image
                                                    </button>
                                                )}
                                            </div>
                                            <input 
                                                id="logo-upload"
                                                type="file" 
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            updateLocalSignature('imageUrl', reader.result as string);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <textarea 
                                        placeholder="<div>Votre code HTML ici...</div>"
                                        value={localSignature.html}
                                        onChange={(e) => updateLocalSignature('html', e.target.value)}
                                        className="w-full h-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs tabular-nums outline-none focus:border-brand-orange mb-4 resize-none dark:text-white"
                                    />
                                )}

                                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 relative overflow-hidden">
                                    <span className="absolute top-2 right-2 text-[10px] uppercase font-bold text-slate-300 tracking-widest">Aperçu</span>
                                    {localSignature.mode === 'standard' ? (
                                        <div className="flex items-center gap-4">
                                            {localSignature.imageUrl && (
                                                <img src={localSignature.imageUrl} alt="Sig" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                                            )}
                                            <div>
                                                <p className="font-serif font-bold text-slate-800 dark:text-white">{localSignature.name}</p>
                                                <p className="text-sm text-slate-500">{localSignature.role}</p>
                                                <p className="text-xs text-brand-orange mt-1">{localAgencyName.toLowerCase().replace(' ', '')}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(localSignature.html || '<span class="text-slate-400 italic">Aperçu HTML</span>') }} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* APPEARANCE TAB */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h3 className="text-xl font-serif text-slate-800 dark:text-white">Thèmes & Ambiance</h3>
                            
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Sélectionnez votre univers</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    
                                    {/* Professional Theme */}
                                    <button 
                                        onClick={() => onThemeChange('light')}
                                        className={`p-4 rounded-2xl border-2 flex flex-col gap-3 transition-all h-32 relative overflow-hidden group ${
                                            currentTheme === 'light' 
                                            ? 'border-brand-orange bg-orange-50' 
                                            : 'border-slate-200 bg-white hover:border-orange-200'
                                        }`}
                                    >
                                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br from-orange-200 to-rose-200 rounded-full opacity-50"></div>
                                        <div className="flex items-center gap-3 z-10">
                                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-brand-orange shadow-sm">
                                                <Sun size={16} />
                                            </div>
                                            <span className="font-bold text-slate-800">Professionnel</span>
                                        </div>
                                        <p className="text-xs text-slate-500 z-10 text-left">
                                            Interface claire, sobre et élégante. Idéal pour les présentations client.
                                        </p>
                                        {currentTheme === 'light' && <div className="absolute top-2 right-2 text-brand-orange"><Check size={16} /></div>}
                                    </button>

                                    {/* Dark Theme */}
                                    <button 
                                        onClick={() => onThemeChange('dark')}
                                        className={`p-4 rounded-2xl border-2 flex flex-col gap-3 transition-all h-32 relative overflow-hidden ${
                                            currentTheme === 'dark' 
                                            ? 'border-brand-orange bg-slate-800' 
                                            : 'border-slate-700 bg-slate-900 opacity-60 hover:opacity-100 hover:border-slate-500'
                                        }`}
                                    >
                                        <div className="absolute inset-0 bg-space-gradient opacity-50"></div>
                                        <div className="flex items-center gap-3 z-10">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-purple-300 shadow-sm">
                                                <Moon size={16} />
                                            </div>
                                            <span className="font-bold text-white">Espace</span>
                                        </div>
                                        <p className="text-xs text-slate-300 z-10 text-left">
                                            Mode sombre profond avec décor spatial et planètes animées.
                                        </p>
                                        {currentTheme === 'dark' && <div className="absolute top-2 right-2 text-white"><Check size={16} /></div>}
                                    </button>

                                    {/* Unicorn Theme */}
                                    <button 
                                        onClick={() => onThemeChange('unicorn')}
                                        className={`p-4 rounded-2xl border-2 flex flex-col gap-3 transition-all h-32 relative overflow-hidden ${
                                            currentTheme === 'unicorn' 
                                            ? 'border-pink-400 bg-pink-50' 
                                            : 'border-slate-200 bg-white hover:border-pink-200'
                                        }`}
                                    >
                                        <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-gradient-to-tr from-cyan-200 to-pink-200 rounded-full blur-xl opacity-60"></div>
                                        <div className="flex items-center gap-3 z-10">
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-pink-500 shadow-sm border border-pink-100">
                                                <Rainbow size={16} />
                                            </div>
                                            <span className="font-bold text-slate-800">Magique</span>
                                        </div>
                                        <p className="text-xs text-slate-500 z-10 text-left">
                                            Arc-en-ciel, nuages et poussière d'étoiles. Une touche de féerie.
                                        </p>
                                        {currentTheme === 'unicorn' && <div className="absolute top-2 right-2 text-pink-500"><Check size={16} /></div>}
                                    </button>

                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Couleur d'accentuation</label>
                                <div className="flex gap-4">
                                    {['#FF7E5F', '#3B82F6', '#10B981', '#8B5CF6'].map((color) => (
                                        <button 
                                            key={color}
                                            onClick={() => onAccentColorChange(color)}
                                            className="w-12 h-12 rounded-full shadow-sm hover:scale-110 transition-transform relative border-2 border-white dark:border-slate-800"
                                            style={{ backgroundColor: color }}
                                        >
                                            {accentColor === color && (
                                                <div className="absolute inset-0 flex items-center justify-center text-white/50">
                                                    <Check size={20} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400">Change la couleur principale des boutons et des indicateurs.</p>
                            </div>
                        </div>
                    )}

                    {/* AI TAB */}
                    {activeTab === 'ai' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                             {/* ─── HERO ─── */}
                             <div className="flex items-center gap-4 bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-2xl text-white shadow-lg">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                                    <Bot size={32} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-serif">IA & Assistants</h3>
                                    <p className="text-sm opacity-90 text-purple-100">Franck, providers IA et outils de prospection</p>
                                </div>
                                <div className="hidden md:flex flex-col items-end gap-1 text-[11px] text-white/80">
                                    <div className="flex items-center gap-1.5">
                                        {aiHealth?.cloudAvailable ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                                        <span>Gemini</span>
                                    </div>
                                    {claudeConfigured && (
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle size={12} /> <span>Claude</span>
                                        </div>
                                    )}
                                    {apolloStatus?.configured && (
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle size={12} /> <span>Apollo</span>
                                        </div>
                                    )}
                                </div>
                             </div>

                             {/* ═══════════════════════════════════════════════════ */}
                             {/* SECTION 1 — Personnalité de Franck                 */}
                             {/* ═══════════════════════════════════════════════════ */}
                             <section className="space-y-5">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                        <Bot size={14} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Personnalité de Franck</h4>
                                        <p className="text-[11px] text-slate-400">Comment ton assistant te parle au quotidien</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ton de la conversation</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'professional', label: 'Professionnel', icon: Briefcase },
                                            { id: 'witty', label: 'Drôle & Zen', icon: Sparkles },
                                            { id: 'minimalist', label: 'Minimaliste', icon: Zap },
                                        ].map(tone => (
                                            <button
                                                key={tone.id}
                                                onClick={() => setLocalAiTone(tone.id)}
                                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                                                    localAiTone === tone.id
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-700 dark:text-purple-300'
                                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                <tone.icon size={22} className={localAiTone === tone.id ? 'text-purple-500' : 'text-slate-400'} />
                                                <span className="text-xs font-bold">{tone.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <Volume2 className="text-slate-400" size={20} />
                                        <div>
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Briefing vocal</div>
                                            <div className="text-xs text-slate-500">Lire le résumé du lundi à haute voix</div>
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => setLocalBriefingVocal(!localBriefingVocal)}
                                        className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${localBriefingVocal ? 'bg-brand-orange' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${localBriefingVocal ? 'left-5' : 'left-1'}`}></div>
                                    </div>
                                </div>
                             </section>

                             {/* ═══════════════════════════════════════════════════ */}
                             {/* SECTION 2 — Moteurs IA                              */}
                             {/* ═══════════════════════════════════════════════════ */}
                             <section className="space-y-5">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                        <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Moteurs IA</h4>
                                        <p className="text-[11px] text-slate-400">Providers connectés (Gemini, Claude, Ollama local)</p>
                                    </div>
                                </div>

                                {/* 2a — Mode IA selector */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode d'exécution</label>
                                    <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                        {([
                                            { id: 'cloud', label: 'Cloud' },
                                            { id: 'hybrid', label: 'Hybride' },
                                            { id: 'local', label: 'Local' },
                                        ] as const).map(mode => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setLocalAiMode(mode.id)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                    localAiMode === mode.id
                                                        ? 'bg-white dark:bg-slate-700 text-brand-orange shadow-sm'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                }`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        <strong>Cloud</strong> : Gemini uniquement · <strong>Hybride</strong> : Local puis fallback cloud · <strong>Local</strong> : Ollama uniquement
                                    </p>
                                </div>

                                {/* 2b — Health card */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Santé des moteurs IA</div>
                                        <div className="text-xs text-slate-500">
                                            {localAiMode === 'cloud'
                                                ? 'Mode Cloud actif — l\'IA locale Ollama n\'est pas utilisée'
                                                : localAiMode === 'local'
                                                    ? 'Mode Local actif — utilise Ollama uniquement'
                                                    : 'Mode Hybride — local en priorité, fallback cloud si indisponible'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => refetchAiHealth()}
                                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <RefreshCw size={13} className={isAiHealthLoading ? 'animate-spin' : ''} />
                                        Refresh
                                    </button>
                                </div>
                                {isAiHealthLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Loader2 size={14} className="animate-spin" />
                                        Vérification du statut IA...
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                        {/* Cloud — toujours pertinent */}
                                        <div className="flex items-center gap-2">
                                            {aiHealth?.cloudAvailable ? <CheckCircle size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
                                            <span className="text-slate-600 dark:text-slate-300">
                                                Cloud (Gemini): {aiHealth?.cloudAvailable ? 'Disponible' : 'Non configuré'}
                                            </span>
                                        </div>

                                        {/* Local — n'a de sens qu'en mode local ou hybride */}
                                        {(localAiMode === 'local' || localAiMode === 'hybrid') ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    {aiHealth?.localAvailable ? <CheckCircle size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
                                                    <span className="text-slate-600 dark:text-slate-300">
                                                        Local (Ollama): {aiHealth?.localAvailable ? 'Disponible' : 'Indisponible'}
                                                    </span>
                                                </div>
                                                <div className="text-slate-600 dark:text-slate-300">
                                                    Latence locale: {typeof aiHealth?.localLatencyMs === 'number' ? `${aiHealth.localLatencyMs} ms` : 'N/A'}
                                                </div>
                                                <div className="text-slate-600 dark:text-slate-300">
                                                    Modèle local: {aiHealth?.localModel || localAiModelName}
                                                </div>
                                                {aiHealth?.localModelAvailable === false && (
                                                    <div className="md:col-span-2 text-amber-600 dark:text-amber-400">
                                                        Modèle non installé dans Ollama. Disponible(s): {(aiHealth?.availableLocalModels || []).join(', ') || 'aucun'}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <AlertCircle size={14} className="text-slate-300 dark:text-slate-600" />
                                                <span>Local (Ollama): non utilisé en mode Cloud</span>
                                            </div>
                                        )}

                                        <div className="text-slate-500 dark:text-slate-400 md:col-span-2 pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">
                                            Backend: {aiHealth?.provider || 'N/A'} · Fallback: {localAiFallbackEnabled ? 'ON' : 'OFF'}
                                        </div>

                                        {/* Erreur locale — friendly + actionnable, uniquement si mode local/hybrid */}
                                        {(localAiMode === 'local' || localAiMode === 'hybrid')
                                            && !aiHealth?.localAvailable
                                            && aiHealth?.errors?.local && (
                                            <div className="md:col-span-2 mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 space-y-2">
                                                <div className="font-semibold flex items-center gap-1.5">
                                                    <AlertCircle size={13} />
                                                    Ollama n'est pas démarré sur ta machine
                                                </div>
                                                <div className="text-[11px] leading-relaxed">
                                                    {localAiMode === 'hybrid'
                                                        ? 'Pas de panique : en mode Hybride, Marion bascule automatiquement sur Gemini.'
                                                        : 'Installe et lance Ollama pour utiliser l\'IA locale, ou bascule sur le mode Cloud ci-dessus.'}
                                                </div>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <a
                                                        href="https://ollama.com/download"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[11px] font-bold underline hover:no-underline"
                                                    >
                                                        Installer Ollama →
                                                    </a>
                                                    <span className="text-[10px] text-amber-500">·</span>
                                                    <button
                                                        onClick={() => setLocalAiMode('cloud')}
                                                        className="text-[11px] font-bold underline hover:no-underline"
                                                    >
                                                        Passer en mode Cloud
                                                    </button>
                                                </div>
                                                <details className="text-[10px] opacity-70">
                                                    <summary className="cursor-pointer">Détails techniques</summary>
                                                    <code className="block mt-1 text-[10px] break-all opacity-80">{aiHealth.errors.local}</code>
                                                </details>
                                            </div>
                                        )}
                                    </div>
                                )}
                             </div>

                                {/* 2c — Local model config (only in local/hybrid) */}
                                {(localAiMode === 'local' || localAiMode === 'hybrid') && (
                                    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Modèle Ollama local</label>
                                            <input
                                                value={localAiModelName}
                                                onChange={(e) => setLocalModelNameState(e.target.value)}
                                                placeholder="qwen2.5:7b-instruct"
                                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-brand-orange"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Fallback cloud</div>
                                                <div className="text-xs text-slate-500">Si Ollama échoue, basculer sur Gemini</div>
                                            </div>
                                            <button
                                                onClick={() => setLocalAiFallbackEnabledState(!localAiFallbackEnabled)}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${localAiFallbackEnabled ? 'bg-brand-orange' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${localAiFallbackEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 2c-bis — Gemini (Google) — provider IA principal */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-sky-500 to-indigo-600 text-white">
                                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 flex-shrink-0">
                                            <span className="font-black text-base">G</span>
                                        </div>
                                        <div className="flex-1">
                                            <h5 className="font-bold text-sm">Gemini (Google)</h5>
                                            <p className="text-[11px] text-white/85">Provider IA principal · clé sauvegardée durablement (DB + .env.local)</p>
                                        </div>
                                        <div className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                            geminiConfigured
                                                ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/30'
                                                : 'bg-white/10 text-white/70 border border-white/20'
                                        }`}>
                                            {geminiConfigured ? <><CheckCircle size={11} /> Connecté</> : <><AlertCircle size={11} /> Non configuré</>}
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
                                        {geminiConfigured ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                                                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Clé Gemini enregistrée</p>
                                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Persistée en base — plus besoin de la ressaisir après un Cmd+Shift+R.</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Remplacer la clé</p>
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type={geminiKeyVisible ? 'text' : 'password'}
                                                                value={geminiKey}
                                                                onChange={(e) => setGeminiKey(e.target.value)}
                                                                placeholder="Nouvelle clé Gemini (AIza...)"
                                                                className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-sky-400 dark:text-white"
                                                            />
                                                            <button onClick={() => setGeminiKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                                {geminiKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                            </button>
                                                        </div>
                                                        <button onClick={handleSaveGeminiKey} disabled={geminiSaving || !geminiKey.trim()} className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2">
                                                            {geminiSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                            Mettre à jour
                                                        </button>
                                                    </div>
                                                </div>
                                                <button onClick={handleRemoveGeminiKey} disabled={geminiSaving} className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1.5 disabled:opacity-50">
                                                    <Trash2 size={13} /> Supprimer la clé Gemini
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Clé Google AI Studio (commence par <code>AIza</code>). Une fois validée, elle est stockée en base et ne te sera plus redemandée.
                                                </p>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type={geminiKeyVisible ? 'text' : 'password'}
                                                            value={geminiKey}
                                                            onChange={(e) => setGeminiKey(e.target.value)}
                                                            placeholder="AIza..."
                                                            className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-sky-400 dark:text-white"
                                                        />
                                                        <button onClick={() => setGeminiKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                            {geminiKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                        </button>
                                                    </div>
                                                    <button onClick={handleSaveGeminiKey} disabled={geminiSaving || !geminiKey.trim()} className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm hover:brightness-105 transition-all flex items-center gap-2">
                                                        {geminiSaving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                                                        Sauvegarder
                                                    </button>
                                                </div>
                                                <a
                                                    href="https://aistudio.google.com/apikey"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                                                >
                                                    Obtenir une clé Gemini gratuite →
                                                </a>
                                            </div>
                                        )}

                                        {geminiMessage && (
                                            <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                                                geminiMessage.type === 'success'
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                                                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                                            }`}>
                                                {geminiMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                                {geminiMessage.text}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 2d — Claude (Anthropic) — provider IA optionnel */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-400 to-red-500 text-white">
                                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 flex-shrink-0">
                                            <span className="font-black text-base">C</span>
                                        </div>
                                        <div className="flex-1">
                                            <h5 className="font-bold text-sm">Claude (Anthropic)</h5>
                                            <p className="text-[11px] text-white/85">Provider IA optionnel · sonnet-4-6 / opus-4-7 · idéal pour Code Review</p>
                                        </div>
                                        <div className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                            claudeConfigured
                                                ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/30'
                                                : 'bg-white/10 text-white/70 border border-white/20'
                                        }`}>
                                            {claudeConfigured ? <><CheckCircle size={11} /> Connecté</> : <><AlertCircle size={11} /> Non configuré</>}
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
                                        {claudeConfigured ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                                                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Clé Anthropic enregistrée</p>
                                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Disponible dans Franck (Code Mode) et les analyses avancées.</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Remplacer la clé</p>
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type={claudeKeyVisible ? 'text' : 'password'}
                                                                value={claudeKey}
                                                                onChange={(e) => setClaudeKey(e.target.value)}
                                                                placeholder="Nouvelle clé Anthropic"
                                                                className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-orange-400 dark:text-white"
                                                            />
                                                            <button onClick={() => setClaudeKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                                {claudeKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                            </button>
                                                        </div>
                                                        <button onClick={handleSaveClaudeKey} disabled={claudeSaving || !claudeKey.trim()} className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2">
                                                            {claudeSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                            Mettre à jour
                                                        </button>
                                                    </div>
                                                </div>
                                                <button onClick={handleRemoveClaudeKey} disabled={claudeSaving} className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                                                    <Trash2 size={13} /> Supprimer la clé Anthropic
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Ajoute Claude comme 3e provider IA (en plus de Gemini et Ollama). Idéal pour le mode Code Review de Franck.
                                                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline ml-1 inline-flex items-center gap-1">Obtenir une clé <ExternalLink size={10} /></a>
                                                </p>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type={claudeKeyVisible ? 'text' : 'password'}
                                                            value={claudeKey}
                                                            onChange={(e) => setClaudeKey(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveClaudeKey()}
                                                            placeholder="sk-ant-api03-..."
                                                            className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-orange-400 dark:text-white"
                                                        />
                                                        <button onClick={() => setClaudeKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                            {claudeKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                        </button>
                                                    </div>
                                                    <button onClick={handleSaveClaudeKey} disabled={claudeSaving || !claudeKey.trim()} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm hover:brightness-105 transition-all flex items-center gap-2">
                                                        {claudeSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        Enregistrer
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {claudeMessage && (
                                            <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
                                                claudeMessage.type === 'success'
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                                                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                                            }`}>
                                                {claudeMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                                {claudeMessage.text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                             </section>

                             {/* ═══════════════════════════════════════════════════ */}
                             {/* SECTION 3 — Outils de Prospection                   */}
                             {/* ═══════════════════════════════════════════════════ */}
                             <section className="space-y-5">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                                        <Telescope size={14} className="text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Outils de Prospection</h4>
                                        <p className="text-[11px] text-slate-400">Sources externes pour trouver et qualifier des prospects</p>
                                    </div>
                                </div>

                             {/* Apollo.io — Prospection B2B */}
                             <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-500 to-violet-600 p-5 text-white">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30 flex-shrink-0">
                                        <Telescope size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-base">Apollo.io — Prospection B2B</h4>
                                        <p className="text-xs text-indigo-100 mt-0.5">210M+ contacts · Fallback IA automatique si crédits épuisés</p>
                                    </div>
                                    {apolloStatus && (
                                        <div className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                                            apolloStatus.configured
                                                ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/30'
                                                : 'bg-white/10 text-white/70 border border-white/20'
                                        }`}>
                                            {apolloStatus.configured ? <><CheckCircle size={12} /> Connecté</> : <><AlertCircle size={12} /> Non configuré</>}
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
                                    {apolloStatus?.configured ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                                                <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Clé Apollo.io enregistrée</p>
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">La prospection utilise Apollo en priorité, Gemini en fallback.</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Remplacer la clé</p>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type={apolloKeyVisible ? 'text' : 'password'}
                                                            value={apolloKey}
                                                            onChange={(e) => setApolloKey(e.target.value)}
                                                            placeholder="Nouvelle clé Apollo.io"
                                                            className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 dark:text-white"
                                                        />
                                                        <button onClick={() => setApolloKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                            {apolloKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={handleSaveApolloKey}
                                                        disabled={apolloSaving || !apolloKey.trim()}
                                                        className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                                                    >
                                                        {apolloSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        Mettre à jour
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleRemoveApolloKey}
                                                disabled={apolloSaving}
                                                className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                <Trash2 size={13} /> Supprimer la clé Apollo
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Connecte ton compte Apollo.io pour rechercher de vrais contacts B2B.
                                                Crée un compte sur <a href="https://app.apollo.io" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline inline-flex items-center gap-1">apollo.io <ExternalLink size={10} /></a> → Settings → API → "Create new API key".
                                            </p>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type={apolloKeyVisible ? 'text' : 'password'}
                                                        value={apolloKey}
                                                        onChange={(e) => setApolloKey(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveApolloKey()}
                                                        placeholder="Colle ta clé API Apollo.io ici"
                                                        className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 dark:text-white"
                                                    />
                                                    <button onClick={() => setApolloKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {apolloKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={handleSaveApolloKey}
                                                    disabled={apolloSaving || !apolloKey.trim()}
                                                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm hover:brightness-105 transition-all flex items-center gap-2"
                                                >
                                                    {apolloSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                    Enregistrer
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {apolloMessage && (
                                        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
                                            apolloMessage.type === 'success'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                                        }`}>
                                            {apolloMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {apolloMessage.text}
                                        </div>
                                    )}
                                </div>
                             </div>

                             {/* Hunter.io — Email Finder */}
                             <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500 to-teal-600 p-5 text-white">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30 flex-shrink-0">
                                        <Mail size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-base">Hunter.io — Recherche d'emails</h4>
                                        <p className="text-xs text-emerald-100 mt-0.5">Trouve les vrais emails professionnels · 25 recherches/mois gratuites</p>
                                    </div>
                                    <div className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                                        hunterConfigured
                                            ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/30'
                                            : 'bg-white/10 text-white/70 border border-white/20'
                                    }`}>
                                        {hunterConfigured ? <><CheckCircle size={12} /> Connecté</> : <><AlertCircle size={12} /> Non configuré</>}
                                    </div>
                                </div>

                                <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
                                    {hunterConfigured ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                                                <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Clé Hunter.io enregistrée</p>
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Les emails des prospects sont recherchés automatiquement lors de chaque import.</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Remplacer la clé</p>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type={hunterKeyVisible ? 'text' : 'password'}
                                                            value={hunterKey}
                                                            onChange={(e) => setHunterKey(e.target.value)}
                                                            placeholder="Nouvelle clé Hunter.io"
                                                            className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-400 dark:text-white"
                                                        />
                                                        <button onClick={() => setHunterKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                            {hunterKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={handleSaveHunterKey}
                                                        disabled={hunterSaving || !hunterKey.trim()}
                                                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                                                    >
                                                        {hunterSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        Mettre à jour
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleRemoveHunterKey}
                                                disabled={hunterSaving}
                                                className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                <Trash2 size={13} /> Supprimer la clé Hunter
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Hunter.io trouve les vrais emails professionnels à partir d'un nom et d'un domaine.
                                                Crée un compte gratuit sur <a href="https://hunter.io" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline inline-flex items-center gap-1">hunter.io <ExternalLink size={10} /></a> → API → copie ta clé.
                                            </p>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type={hunterKeyVisible ? 'text' : 'password'}
                                                        value={hunterKey}
                                                        onChange={(e) => setHunterKey(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveHunterKey()}
                                                        placeholder="Colle ta clé API Hunter.io ici"
                                                        className="w-full px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-400 dark:text-white"
                                                    />
                                                    <button onClick={() => setHunterKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {hunterKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={handleSaveHunterKey}
                                                    disabled={hunterSaving || !hunterKey.trim()}
                                                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm hover:brightness-105 transition-all flex items-center gap-2"
                                                >
                                                    {hunterSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                    Enregistrer
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {hunterMessage && (
                                        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
                                            hunterMessage.type === 'success'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                                        }`}>
                                            {hunterMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {hunterMessage.text}
                                        </div>
                                    )}
                                </div>
                             </div>
                             </section>

                        </div>
                    )}

                    {/* NOTIFICATIONS TAB */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h3 className="text-xl font-serif text-slate-800 dark:text-white mb-6">Centre de Notifications</h3>
                            
                            {localNotifications.map((notif: any) => (
                                <div key={notif.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                    <div>
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{notif.title}</div>
                                        <div className="text-xs text-slate-400">{notif.desc}</div>
                                    </div>
                                    <button 
                                        onClick={() => setLocalNotifications(localNotifications.map((n: any) => n.id === notif.id ? { ...n, checked: !n.checked } : n))}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${notif.checked ? 'bg-brand-orange' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${notif.checked ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CLOUD & SYNC TAB */}
                    {activeTab === 'cloud' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h3 className="text-xl font-serif text-slate-800 dark:text-white mb-2">Stockage Cloud</h3>
                            <p className="text-sm text-slate-500 mb-6">Synchronisez automatiquement les fichiers de vos clients avec votre cloud préféré.</p>

                            {/* Santé des données — SQLite local */}
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl p-5 border border-emerald-200/80 dark:border-emerald-800/50">
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield size={18} className="text-emerald-600 dark:text-emerald-400" />
                                    <h4 className="font-bold text-slate-800 dark:text-white">Santé des données</h4>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                                    La base SQLite est sauvegardée au démarrage du serveur et selon la planification. Pour restaurer une copie, voir la documentation du projet&nbsp;:
                                    <code className="mx-1 text-[10px] bg-white/60 dark:bg-slate-800 px-1 rounded">docs/backup-restore.md</code>
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                                    <div className="bg-white/70 dark:bg-slate-800/80 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/40">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Dernière sauvegarde locale</p>
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                                            {backupStatus?.lastBackup
                                                ? new Date(backupStatus.lastBackup).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </p>
                                    </div>
                                    <div className="bg-white/70 dark:bg-slate-800/80 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/40">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Fichiers conservés / taille</p>
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                                            {backupStatus != null ? `${backupStatus.backupCount} · ${backupStatus.totalSizeMB} Mo` : '…'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => manualLocalBackupMutation.mutate(undefined, { onSuccess: () => refetchBackupStatus() })}
                                        disabled={manualLocalBackupMutation.isPending}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-50"
                                    >
                                        {manualLocalBackupMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
                                        Sauvegarder maintenant
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => downloadBundleMutation.mutate()}
                                        disabled={downloadBundleMutation.isPending}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm font-bold rounded-xl"
                                    >
                                        {downloadBundleMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                                        Télécharger paquet (.zip)
                                    </button>
                                </div>
                                {manualLocalBackupMutation.isSuccess && (
                                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{manualLocalBackupMutation.data?.message || 'Sauvegarde créée.'}</p>
                                )}
                                {(manualLocalBackupMutation.isError || downloadBundleMutation.isError) && (
                                    <p className="mt-2 text-xs text-red-600">{(manualLocalBackupMutation.error as Error)?.message || (downloadBundleMutation.error as Error)?.message}</p>
                                )}
                            </div>

                            {/* Google Drive */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
                                            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                                                <path d="M4.433 22l4.232-7.33L16.898 2h-7.34L1 16.665 4.433 22z" fill="#4285F4"/>
                                                <path d="M16.898 2l-8.233 12.67L4.433 22H23l-4.232-7.33L16.898 2z" fill="#FBBC04"/>
                                                <path d="M1 16.665L4.433 22h18.567l-4.232-7.335H1z" fill="#34A853"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white">Google Drive</h4>
                                            <p className="text-xs text-slate-400">
                                                {cloudConfig.googleDrive.connected 
                                                    ? `Connecté: ${cloudConfig.googleDrive.email || cloudConfig.googleDrive.name || 'Compte Google'}` 
                                                    : 'Non connecté'}
                                            </p>
                                        </div>
                                    </div>
                                    {cloudConfig.googleDrive.connected ? (
                                        <button
                                            onClick={() => handleDisconnectCloud('googleDrive')}
                                            className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            Déconnecter
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleConnectCloud('googleDrive')}
                                            disabled={isConnecting}
                                            className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <RefreshCw size={14} className="animate-spin" /> Connexion...
                                                </>
                                            ) : (
                                                <>
                                                    <ExternalLink size={14} /> Connecter
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                {cloudConfig.googleDrive.connected && (
                                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-600">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Dossier de synchronisation</label>
                                            <input
                                                type="text"
                                                value={cloudConfig.googleDrive.folder}
                                                onChange={(e) => handleCloudConfigChange('googleDrive', 'folder', e.target.value)}
                                                placeholder="/Eonora Tech OS/Clients"
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-brand-orange"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600 dark:text-slate-300">Synchronisation active</span>
                                            <button
                                                onClick={() => handleCloudConfigChange('googleDrive', 'enabled', !cloudConfig.googleDrive.enabled)}
                                                className={`w-12 h-6 rounded-full transition-colors ${cloudConfig.googleDrive.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${cloudConfig.googleDrive.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                            </button>
                                        </div>

                                        {/* Cloud Backup Section */}
                                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-600">
                                            <div className="flex items-center gap-2 mb-3">
                                                <CloudUpload size={16} className="text-blue-500" />
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Sauvegardes sur Drive</span>
                                            </div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm text-slate-600 dark:text-slate-300">Sauvegardes automatiques</span>
                                                <button
                                                    onClick={() => setCloudBackupConfigMutation.mutate(!isCloudBackupEnabled)}
                                                    className={`w-12 h-6 rounded-full transition-colors ${isCloudBackupEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                >
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${isCloudBackupEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                            {isCloudBackupEnabled && (
                                                <p className="text-xs text-slate-400 mb-3">
                                                    Les backups seront uploadés sur Google Drive toutes les {parseInt(localStorage.getItem('BACKUP_INTERVAL_HOURS') || '6')}h dans le dossier "Marion Backups".
                                                </p>
                                            )}
                                            <button
                                                onClick={() => cloudBackupMutation.mutate()}
                                                disabled={cloudBackupMutation.isPending}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                                            >
                                                {cloudBackupMutation.isPending ? (
                                                    <>
                                                        <Loader2 size={14} className="animate-spin" /> Sauvegarde en cours...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload size={14} /> Sauvegarder maintenant sur Drive
                                                    </>
                                                )}
                                            </button>
                                            {cloudBackupMutation.isSuccess && cloudBackupMutation.data?.driveLink && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                                    <CheckCircle size={12} />
                                                    <span>Sauvegarde réussie</span>
                                                    <a href={cloudBackupMutation.data.driveLink} target="_blank" rel="noopener noreferrer" className="underline ml-1">Ouvrir sur Drive</a>
                                                </div>
                                            )}
                                            {cloudBackupMutation.isError && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
                                                    <AlertCircle size={12} />
                                                    <span>{(cloudBackupMutation.error as Error)?.message || 'Erreur lors de la sauvegarde'}</span>
                                                </div>
                                            )}
                                            {backupStatus?.lastCloudBackup && (
                                                <div className="mt-3 p-2.5 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-slate-500">Dernier backup cloud</span>
                                                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                                                            {new Date(backupStatus.lastCloudBackup).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    {backupStatus.lastCloudBackupLink && (
                                                        <a 
                                                            href={backupStatus.lastCloudBackupLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="mt-1.5 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                                                        >
                                                            <ExternalLink size={10} /> Ouvrir sur Drive
                                                        </a>
                                                    )}
                                                    {backupStatus.cloudBackups && backupStatus.cloudBackups.length > 0 && (
                                                        <div className="mt-2 text-xs text-slate-400">
                                                            {backupStatus.cloudBackups.length} sauvegarde{backupStatus.cloudBackups.length > 1 ? 's' : ''} sur Drive
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dropbox */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
                                            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#0061FF">
                                                <path d="M6 2L0 6l6 4 6-4-6-4zm12 0l-6 4 6 4 6-4-6-4zM0 14l6 4 6-4-6-4-6 4zm18-4l-6 4 6 4 6-4-6-4zM6 20l6 4 6-4-6-4-6 4z"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white">Dropbox</h4>
                                            <p className="text-xs text-slate-400">
                                                {cloudConfig.dropbox.connected ? 'Connecté' : 'Non connecté'}
                                            </p>
                                        </div>
                                    </div>
                                    {cloudConfig.dropbox.connected ? (
                                        <button
                                            onClick={() => handleDisconnectCloud('dropbox')}
                                            className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            Déconnecter
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleConnectCloud('dropbox')}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                        >
                                            <ExternalLink size={14} /> Connecter
                                        </button>
                                    )}
                                </div>
                                {cloudConfig.dropbox.connected && (
                                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-600">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Dossier de synchronisation</label>
                                            <input
                                                type="text"
                                                value={cloudConfig.dropbox.folder}
                                                onChange={(e) => handleCloudConfigChange('dropbox', 'folder', e.target.value)}
                                                placeholder="/Eonora Tech OS/Clients"
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-brand-orange"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600 dark:text-slate-300">Synchronisation active</span>
                                            <button
                                                onClick={() => handleCloudConfigChange('dropbox', 'enabled', !cloudConfig.dropbox.enabled)}
                                                className={`w-12 h-6 rounded-full transition-colors ${cloudConfig.dropbox.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${cloudConfig.dropbox.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Auto-Sync Settings */}
                            <div className="bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 rounded-2xl p-5 border border-orange-100 dark:border-orange-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <RefreshCw size={20} className="text-brand-orange" />
                                    <h4 className="font-bold text-slate-800 dark:text-white">Synchronisation Automatique</h4>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Activer la sync automatique</span>
                                            <p className="text-xs text-slate-400">Les fichiers seront synchronisés en arrière-plan</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const updated = { ...cloudConfig, autoSync: !cloudConfig.autoSync };
                                                setCloudConfig(updated);
                                                localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
                                            }}
                                            className={`w-12 h-6 rounded-full transition-colors ${cloudConfig.autoSync ? 'bg-brand-orange' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${cloudConfig.autoSync ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                    {cloudConfig.autoSync && (
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Intervalle de synchronisation</label>
                                            <select
                                                value={cloudConfig.syncInterval}
                                                onChange={(e) => {
                                                    const updated = { ...cloudConfig, syncInterval: parseInt(e.target.value) };
                                                    setCloudConfig(updated);
                                                    localStorage.setItem('marion_cloud_config', JSON.stringify(updated));
                                                }}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none"
                                            >
                                                <option value={5}>Toutes les 5 minutes</option>
                                                <option value={15}>Toutes les 15 minutes</option>
                                                <option value={30}>Toutes les 30 minutes</option>
                                                <option value={60}>Toutes les heures</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info Note */}
                            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                <AlertCircle size={18} className="text-blue-500 mt-0.5" />
                                <div>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        <strong>Note:</strong> La synchronisation cloud nécessite une connexion à votre compte Google ou Dropbox. 
                                        Vos fichiers clients seront automatiquement organisés par projet.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DONNÉES LOCALES TAB — chemin dossiers clients (visible dans la barre latérale) */}
                    {activeTab === 'localData' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-500 to-slate-700 p-6 rounded-2xl text-white shadow-lg">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                                    <HardDrive size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Données locales</h3>
                                    <p className="text-sm text-white/80">Où Marion lit vos dossiers clients sur ce Mac</p>
                                </div>
                            </div>

                            <LocalClientFoldersCard
                                paths={mergedLocalPaths}
                                loading={localPathsLoading}
                                pathCopied={pathCopied}
                                onCopyPath={handleCopyDataPath}
                                onCopyDefaultPathHint={handleCopyDefaultDataPathHint}
                                fallbackNote={pathsFallbackNote}
                            />
                            <ClientDataPathSettingCard isOpen={isOpen} />
                            <ServerInstallDiagnostic payload={versionData} />
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Header */}
                            <div className="flex items-center gap-4 bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-2xl text-white shadow-lg">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                                    <Shield size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Sécurité</h3>
                                    <p className="text-sm text-white/80">Protégez vos données avec un mot de passe et le chiffrement</p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Ces réglages sont aussi rassemblés sous l’onglet{' '}
                                <button
                                    type="button"
                                    className="font-bold text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
                                    onClick={() => setActiveTab('localData')}
                                >
                                    Données locales
                                </button>
                                .
                            </p>

                            <LocalClientFoldersCard
                                paths={mergedLocalPaths}
                                loading={localPathsLoading}
                                pathCopied={pathCopied}
                                onCopyPath={handleCopyDataPath}
                                onCopyDefaultPathHint={handleCopyDefaultDataPathHint}
                                fallbackNote={pathsFallbackNote}
                            />
                            <ClientDataPathSettingCard isOpen={isOpen} />
                            <ServerInstallDiagnostic payload={versionData} />

                            {/* Authentication Status */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Lock size={18} className="text-purple-500" />
                                    Authentification
                                </h4>
                                
                                <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                                            <Check size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-emerald-700 dark:text-emerald-300">Protection active</p>
                                            <p className="text-sm text-emerald-600 dark:text-emerald-400">Vos données sont chiffrées et sécurisées</p>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    Un mot de passe protège l'accès à Eonora Tech OS. Vos tokens OAuth et données sensibles 
                                    (coffre-fort, notes privées) sont chiffrés avec ce mot de passe.
                                </p>

                                {/* Security Features */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Check size={16} className="text-emerald-500" />
                                        Chiffrement AES-256 des données sensibles
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Check size={16} className="text-emerald-500" />
                                        Tokens OAuth Google chiffrés
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Check size={16} className="text-emerald-500" />
                                        Session automatiquement expirée après 8h
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Check size={16} className="text-emerald-500" />
                                        Protection contre les tentatives de force brute
                                    </div>
                                </div>
                            </div>

                            {/* Session Management */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Key size={18} className="text-purple-500" />
                                    Session
                                </h4>
                                
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    Vous pouvez vous déconnecter pour verrouiller l'accès à l'application. 
                                    Un mot de passe sera requis pour accéder de nouveau.
                                </p>

                                <button
                                    onClick={() => {
                                        // Clear session and reload
                                        sessionStorage.removeItem('marion_token');
                                        fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
                                        window.location.reload();
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-medium"
                                >
                                    <LogOut size={18} />
                                    Se déconnecter
                                </button>
                            </div>

                            {/* Data Privacy Info */}
                            <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                                <Shield size={18} className="text-purple-500 mt-0.5" />
                                <div>
                                    <p className="text-sm text-purple-700 dark:text-purple-300">
                                        <strong>Confidentialité:</strong> Toutes vos données restent sur votre ordinateur. 
                                        Aucune information n'est envoyée à des serveurs externes, sauf pour les services 
                                        que vous connectez explicitement (Google Calendar, Drive).
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* UPDATES TAB */}
                    {activeTab === 'updates' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Header */}
                            <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-2xl text-white shadow-lg">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                                    <Package size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Mises à jour</h3>
                                    <p className="text-sm text-white/80">Gardez Eonora Tech OS à jour avec les dernières fonctionnalités</p>
                                </div>
                            </div>

                            {/* Current Version */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shadow-lg">
                                            <Sparkles size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white">Version actuelle</h4>
                                            <p className="text-2xl font-bold text-brand-orange">
                                                v{updateInfo?.currentVersion || '...'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={checkForUpdates}
                                        disabled={isCheckingUpdate}
                                        className="px-5 py-2.5 bg-brand-orange text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-orange-200 dark:shadow-none"
                                    >
                                        {isCheckingUpdate ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Vérification...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw size={16} /> Vérifier les mises à jour
                                            </>
                                        )}
                                    </button>
                                </div>
                                {(updateInfo?.localCommit || updateInfo?.remoteCommit) && (
                                    <p className="text-xs text-slate-500 mt-3 font-mono">
                                        Code local : {updateInfo.localCommit || '—'}
                                        {' · '}
                                        GitHub main : {updateInfo.remoteCommit || '—'}
                                    </p>
                                )}
                            </div>

                            {/* Sync / Update — toujours disponible */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                    {updateInfo?.message
                                        || 'Télécharge la dernière version depuis GitHub (branche main), comme quand Johan pousse ses modifications.'}
                                </p>
                                <button
                                    onClick={applyUpdate}
                                    disabled={isUpdating}
                                    className="px-6 py-3 bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
                                >
                                    {isUpdating ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" /> Synchronisation…
                                        </>
                                    ) : (
                                        <>
                                            <Download size={18} />
                                            {updateInfo?.updateAvailable ? 'Mettre à jour maintenant' : 'Synchroniser depuis GitHub'}
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Update Available (détails release) */}
                            {updateInfo?.updateAvailable && (
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-5 border-2 border-emerald-200 dark:border-emerald-700">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                            <ArrowUpCircle size={24} className="text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-emerald-700 dark:text-emerald-300 text-lg flex items-center gap-2">
                                                Nouvelle version disponible ! 
                                                <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                                                    v{updateInfo.latestVersion}
                                                </span>
                                            </h4>
                                            {updateInfo.releaseName && (
                                                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                                                    {updateInfo.releaseName}
                                                </p>
                                            )}
                                            {updateInfo.publishedAt && (
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-2">
                                                    <Clock size={12} /> 
                                                    Publiée le {new Date(updateInfo.publishedAt).toLocaleDateString('fr-FR', { 
                                                        year: 'numeric', month: 'long', day: 'numeric' 
                                                    })}
                                                </p>
                                            )}
                                            {updateInfo.releaseNotes && (
                                                <div className="mt-4 p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
                                                    <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                                        <FileText size={12} /> Notes de version
                                                    </p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                                        {updateInfo.releaseNotes.slice(0, 500)}
                                                        {updateInfo.releaseNotes.length > 500 && '...'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {updateInfo?.htmlUrl && (
                                <a
                                    href={updateInfo.htmlUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-brand-orange font-bold hover:underline"
                                >
                                    <ExternalLink size={14} /> Voir les releases sur GitHub
                                </a>
                            )}

                            {/* Already up to date — hidden duplicate sync CTA */}
                            {updateInfo && !updateInfo.updateAvailable && !updateInfo.error && updateInfo.latestVersion && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-800">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                                            <CheckCircle size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-emerald-700 dark:text-emerald-300">Vous êtes à jour !</h4>
                                            <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                                {updateInfo.message || `Eonora Tech OS v${updateInfo.currentVersion} est la dernière version.`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {updateInfo?.error && (
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 border border-red-100 dark:border-red-800">
                                    <div className="flex items-center gap-4">
                                        <AlertCircle size={24} className="text-red-500" />
                                        <div>
                                            <h4 className="font-bold text-red-700 dark:text-red-300">Erreur</h4>
                                            <p className="text-sm text-red-600 dark:text-red-400">{updateInfo.error}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Update Message */}
                            {updateMessage && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800">
                                    <div className="flex items-start gap-4">
                                        <AlertCircle size={24} className="text-blue-500 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold text-blue-700 dark:text-blue-300">Mise à jour</h4>
                                            <p className="text-sm text-blue-600 dark:text-blue-400">{updateMessage}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Data Safety Info */}
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-5 border border-purple-100 dark:border-purple-800">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
                                        <Shield size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-purple-700 dark:text-purple-300">Vos données sont protégées</h4>
                                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                                            Lors d'une mise à jour, seuls les fichiers de l'application sont remplacés. 
                                            <strong> Vos données sont conservées :</strong>
                                        </p>
                                        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                            <li className="flex items-center gap-2">
                                                <Check size={16} className="text-emerald-500" />
                                                Tous vos dossiers clients et fichiers
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check size={16} className="text-emerald-500" />
                                                Profils clients, Coffre-fort, Brand Center
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check size={16} className="text-emerald-500" />
                                                Factures, devis et historique
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check size={16} className="text-emerald-500" />
                                                Connexion Google Calendar & Drive
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check size={16} className="text-emerald-500" />
                                                Préférences et paramètres
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Manual Update Instructions */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                    <Code size={18} className="text-slate-500" /> Mise à jour manuelle
                                </h4>
                                <p className="text-sm text-slate-500 mb-3">
                                    Vous pouvez aussi mettre à jour manuellement en double-cliquant sur :
                                </p>
                                <code className="block px-4 py-3 bg-slate-900 text-emerald-400 rounded-xl text-sm tabular-nums">
                                    METTRE_A_JOUR.command
                                </code>
                                <p className="text-xs text-slate-400 mt-2">
                                    Ce fichier se trouve dans le dossier Eonora Tech OS sur votre Bureau.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-4xl">
                <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors">
                    Annuler
                </button>
                <button 
                    onClick={handleSave}
                    className="px-6 py-2.5 rounded-xl bg-brand-orange text-white font-bold text-sm hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 dark:shadow-none flex items-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Enregistrement...
                        </>
                    ) : (
                        <>
                            <Check size={16} /> Enregistrer
                        </>
                    )}
                </button>
            </div>
        </Modal>
    );
};
