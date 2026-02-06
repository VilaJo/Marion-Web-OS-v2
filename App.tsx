import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Project, ProjectStatus, CalendarEvent, FinderItem, WorkflowPhase, Notification, NotificationType, Theme, Invoice, Activity } from './types';
import { MOCK_PROJECTS, MOCK_EVENTS, FINDER_ROOT } from './constants';
import { formatCurrency, formatCurrencyWithSymbol } from './utils';
// Lazy loaded components
const ClientView = React.lazy(() => import('./components/ClientView').then(module => ({ default: module.ClientView })));
const FranckChat = React.lazy(() => import('./components/FranckChat').then(module => ({ default: module.FranckChat })));
const Importer = React.lazy(() => import('./components/Importer').then(module => ({ default: module.Importer })));
const FileDispatcher = React.lazy(() => import('./components/FileDispatcher').then(module => ({ default: module.FileDispatcher })));
const Agenda = React.lazy(() => import('./components/Agenda').then(module => ({ default: module.Agenda })));
const SettingsModal = React.lazy(() => import('./components/Settings').then(module => ({ default: module.SettingsModal })));
const FinanceDashboard = React.lazy(() => import('./components/FinanceDashboard').then(module => ({ default: module.FinanceDashboard })));
const FinancialHealthWidget = React.lazy(() => import('./components/FinancialHealthWidget').then(module => ({ default: module.FinancialHealthWidget })));
const InvoiceBuilder = React.lazy(() => import('./components/InvoiceBuilder').then(module => ({ default: module.InvoiceBuilder })));
const Onboarding = React.lazy(() => import('./components/Onboarding'));
const GoalsKPIs = React.lazy(() => import('./components/GoalsKPIs').then(module => ({ default: module.GoalsKPIs })));
const DocumentTemplates = React.lazy(() => import('./components/DocumentTemplates').then(module => ({ default: module.DocumentTemplates })));
const MessagingHub = React.lazy(() => import('./components/MessagingHub').then(module => ({ default: module.MessagingHub })));
const MediaStudio = React.lazy(() => import('./components/MediaStudio').then(module => ({ default: module.MediaStudio })));
const FocusMode = React.lazy(() => import('./components/FocusMode').then(module => ({ default: module.FocusMode })));
const TourGuide = React.lazy(() => import('./components/TourGuide').then(module => ({ default: module.TourGuide })));
const BugReporter = React.lazy(() => import('./components/BugReporter').then(module => ({ default: module.BugReporter })));
const WhatsNew = React.lazy(() => import('./components/WhatsNew').then(module => ({ default: module.WhatsNew })));
const PWAInstallPrompt = React.lazy(() => import('./components/PWAInstallPrompt').then(module => ({ default: module.PWAInstallPrompt })));

import { AmbientPlayer } from './components/AmbientPlayer';
import { Card, Badge, Modal, Tooltip, EmptyState } from './components/Shared';
import { SplashScreen } from './components/SplashScreen';
import { NotificationCenterPanel, ToastItem } from './components/NotificationSystem';
import { QuickNotes } from './components/QuickNotes';
import { generateBriefing } from './services/geminiService';
import { LoginScreen } from './components/LoginScreen';
import { apiFetch } from './services/api';

// --- Authentication Context ---
// Global auth token for API calls
let globalAuthToken: string | null = null;

export const getAuthToken = () => globalAuthToken;
export const setAuthToken = (token: string | null) => { 
    globalAuthToken = token;
    if (token) {
        sessionStorage.setItem('marion_token', token);
    } else {
        sessionStorage.removeItem('marion_token');
    }
};
import { 
    LayoutGrid, 
    Bell, 
    Settings, 
    Sun, 
    Moon, 
    Search, 
    Plus,
    Archive,
    PieChart,
    UploadCloud,
    CheckSquare,
    HelpCircle,
    ArrowUpRight,
    CheckCircle,
    Layers,
    Bot,
    Zap,
    FolderOpen,
    Calendar,
    Sparkles,
    Heart,
    Trash2,
    Coffee,
    RefreshCw,
    Flashlight,
    Rocket,
    MessageCircle,
    Wand2,
    Play,
    Tent,
    Database,
    Mail,
    AlertTriangle,
    DollarSign,
    ArrowUp,
    FileText,
    FolderPlus,
    User,
    Palette,
    Upload,
    Clock,
    StickyNote,
    Target,
    Settings as SettingsIcon
} from 'lucide-react';
import { SOUNDS } from './constants';

declare const confetti: any;

// --- Main App Component ---

interface ProjectCardProps {
    project: Project;
    onClick: () => void;
    onStatusCycle: (e: React.MouseEvent) => void;
}

// Helper functions for ProjectCard
const getProjectHealth = (project: Project): 'good' | 'warning' | 'danger' => {
    const overdueInvoices = project.invoices.filter(i => 
        i.status === 'Pending' && i.dueDate && new Date(i.dueDate) < new Date()
    ).length;
    const pendingTasks = project.tasks.filter(t => !t.completed).length;
    const hasOverdueTasks = project.tasks.some(t => 
        !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
    );
    
    if (overdueInvoices > 0 || hasOverdueTasks) return 'danger';
    if (pendingTasks > 10 || project.invoices.some(i => i.status === 'Pending')) return 'warning';
    return 'good';
};

const getPendingAmount = (project: Project): number => {
    return project.invoices
        .filter(i => i.status === 'Pending' || i.status === 'Partial')
        .reduce((sum, inv) => {
            const paid = inv.payments?.reduce((p, pay) => p + pay.amount, 0) || 0;
            return sum + (inv.amount - paid);
        }, 0);
};

const getTotalRevenue = (project: Project): number => {
    return project.invoices
        .filter(i => i.status === 'Paid')
        .reduce((sum, inv) => sum + inv.amount, 0);
};

const getNextDeadline = (project: Project): { title: string; date: string } | null => {
    const taskWithDeadline = project.tasks
        .filter(t => !t.completed && t.dueDate)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
    
    if (taskWithDeadline) {
        return { title: taskWithDeadline.title, date: taskWithDeadline.dueDate! };
    }
    return null;
};

const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return "demain";
    if (diffDays > 1 && diffDays <= 7) return `dans ${diffDays}j`;
    if (diffDays > 7) return date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
    if (diffDays === -1) return "hier";
    return `il y a ${Math.abs(diffDays)}j`;
};

// Status color configurations
const getStatusColors = (status: ProjectStatus) => {
    switch (status) {
        case ProjectStatus.ACTIVE:
            return {
                primary: '#10B981', // emerald
                secondary: '#34D399',
                cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
                border: 'border-emerald-100/50 dark:border-emerald-900/30',
                glow1: 'bg-brand-orange/60',
                glow2: 'bg-purple-500/50',
                bar: 'bg-gradient-to-b from-emerald-400 to-teal-500',
                avatarBg: 'from-emerald-50 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30',
                avatarText: 'text-emerald-600 dark:text-emerald-400',
                progress: 'from-emerald-400 via-teal-400 to-cyan-400'
            };
        case ProjectStatus.PROSPECT:
            return {
                primary: '#F59E0B', // amber
                secondary: '#FBBF24',
                cardBg: 'bg-amber-50/50 dark:bg-amber-950/20',
                border: 'border-amber-100/50 dark:border-amber-900/30',
                glow1: 'bg-brand-orange/60',
                glow2: 'bg-purple-500/50',
                bar: 'bg-gradient-to-b from-amber-400 to-yellow-500',
                avatarBg: 'from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30',
                avatarText: 'text-amber-600 dark:text-amber-400',
                progress: 'from-amber-400 via-yellow-400 to-orange-400'
            };
        case ProjectStatus.PRO_BONO:
            return {
                primary: '#8B5CF6', // violet
                secondary: '#A78BFA',
                cardBg: 'bg-violet-50/50 dark:bg-violet-950/20',
                border: 'border-violet-100/50 dark:border-violet-900/30',
                glow1: 'bg-brand-orange/60',
                glow2: 'bg-purple-500/50',
                bar: 'bg-gradient-to-b from-violet-400 to-purple-500',
                avatarBg: 'from-violet-50 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30',
                avatarText: 'text-violet-600 dark:text-violet-400',
                progress: 'from-violet-400 via-purple-400 to-fuchsia-400'
            };
        case ProjectStatus.PERSO:
            return {
                primary: '#EC4899', // pink
                secondary: '#F472B6',
                cardBg: 'bg-pink-50/50 dark:bg-pink-950/20',
                border: 'border-pink-100/50 dark:border-pink-900/30',
                glow1: 'bg-brand-orange/60',
                glow2: 'bg-purple-500/50',
                bar: 'bg-gradient-to-b from-pink-400 to-rose-500',
                avatarBg: 'from-pink-50 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30',
                avatarText: 'text-pink-600 dark:text-pink-400',
                progress: 'from-pink-400 via-rose-400 to-red-400'
            };
        case ProjectStatus.ARCHIVED:
        default:
            return {
                primary: '#64748B', // slate
                secondary: '#94A3B8',
                cardBg: 'bg-slate-50/50 dark:bg-slate-900/20',
                border: 'border-slate-100/50 dark:border-slate-800/30',
                glow1: 'bg-brand-orange/60',
                glow2: 'bg-purple-500/50',
                bar: 'bg-gradient-to-b from-slate-400 to-gray-500',
                avatarBg: 'from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-800',
                avatarText: 'text-slate-500 dark:text-slate-400',
                progress: 'from-slate-400 via-gray-400 to-slate-500'
            };
    }
};

const ProjectCard: React.FC<ProjectCardProps> = React.memo(({ project, onClick, onStatusCycle }) => {
    const health = getProjectHealth(project);
    const pendingAmount = getPendingAmount(project);
    const totalRevenue = getTotalRevenue(project);
    const nextDeadline = getNextDeadline(project);
    const pendingTasks = project.tasks.filter(t => !t.completed).length;
    const colors = getStatusColors(project.status);
    
    return (
        <Card 
            onClick={onClick} 
            className={`group transition-all duration-500 cursor-pointer 
            ${colors.cardBg} ${colors.border}
            hover:scale-[1.03] hover:border-brand-orange/60 dark:hover:border-brand-orange/60
            hover:shadow-[0_20px_50px_-12px_rgba(255,126,95,0.5)] dark:hover:shadow-[0_20px_50px_-12px_rgba(255,126,95,0.3)] 
            relative overflow-hidden`}
        >
            {/* Colorful Hover Glow Effects - Marion Effect */}
            <div className={`absolute -right-20 -top-20 w-64 h-64 ${colors.glow1} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0`}></div>
            <div className={`absolute -left-20 -bottom-20 w-64 h-64 ${colors.glow2} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0`}></div>
            
            {/* Left Accent Bar - Orange on hover like New Project button */}
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-brand-orange to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_10px_rgba(255,126,95,0.5)] z-10" />
            
            {/* Health Indicator (small dot) */}
            <div className={`absolute top-3 right-3 w-2 h-2 rounded-full z-20 ${
                health === 'good' ? 'bg-emerald-400' : 
                health === 'warning' ? 'bg-amber-400' : 
                'bg-red-400 animate-pulse'
            }`} />
            
            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    {/* Avatar with status color */}
                    <div 
                        className={`w-14 h-14 rounded-3xl bg-gradient-to-br ${colors.avatarBg} flex items-center justify-center text-xl font-serif font-bold shadow-inner border border-white/50 dark:border-white/5 group-hover:scale-110 transition-transform duration-300 group-hover:rotate-3 group-hover:shadow-lg ${colors.avatarText}`}
                    >
                        {project.avatarInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-xl leading-tight text-slate-800 dark:text-slate-100 group-hover:text-brand-orange dark:group-hover:text-orange-300 transition-colors truncate">
                            {project.clientName}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">{project.phase}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <Badge color={
                        project.status === ProjectStatus.ACTIVE ? 'green' : 
                        project.status === ProjectStatus.PROSPECT ? 'yellow' : 
                        project.status === ProjectStatus.PRO_BONO ? 'purple' : 
                        project.status === ProjectStatus.PERSO ? 'pink' : 'gray'
                    }>
                        {project.status === ProjectStatus.ARCHIVED && project.archiveCategory
                            ? `Archivé - ${project.archiveCategory}`
                            : project.status}
                    </Badge>
                </div>
            </div>
            
            {/* Progress Bar - Enhanced with status gradient */}
            <div className="mb-4 relative z-10">
                <div className="flex justify-between text-xs font-medium text-slate-400 mb-1.5">
                    <span>Progression</span>
                    <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                        className={`bg-gradient-to-r ${colors.progress} h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.2)]`}
                        style={{ width: `${project.progress}%` }}
                    />
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                    <CheckSquare size={12} className="text-brand-orange" /> 
                    <span>{pendingTasks}</span>
                </span>
                {pendingAmount > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                        <Clock size={12} /> 
                        {formatCurrencyWithSymbol(pendingAmount, 'CHF', 0)}
                    </span>
                ) : totalRevenue > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                        <DollarSign size={12} /> 
                        {formatCurrencyWithSymbol(totalRevenue, 'CHF', 0)}
                    </span>
                ) : null}
                {project.unreadEmailCount !== undefined && project.unreadEmailCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg animate-pulse">
                        <Mail size={12} /> {project.unreadEmailCount}
                    </span>
                )}
            </div>

            {/* Next Deadline or Action */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 relative z-10">
                {nextDeadline ? (
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <Calendar size={12} className="text-purple-500" />
                            <span className="font-medium">Deadline</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[100px]">
                                {nextDeadline.title}
                            </span>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                new Date(nextDeadline.date) < new Date() 
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                                    : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                            }`}>
                                {formatRelativeDate(nextDeadline.date)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Prochaine action</span>
                        <span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[150px]">
                            {project.tasks.filter(t => !t.completed)[0]?.title || "Rien à faire ✨"}
                        </span>
                    </div>
                )}
            </div>
        </Card>
    );
});

const StatusChart = ({ projects, onClick }: { projects: Project[], onClick: () => void }) => {
    const total = projects.length;
    const active = projects.filter(p => p.status === ProjectStatus.ACTIVE).length;
    const prospect = projects.filter(p => p.status === ProjectStatus.PROSPECT).length;
    const archived = projects.filter(p => p.status === ProjectStatus.ARCHIVED).length;
    
    // Calculate simple percentages for a donut visualization
    const activePct = total > 0 ? (active / total) * 100 : 0;
    const prospectPct = total > 0 ? (prospect / total) * 100 : 0;
    
    return (
        <Card onClick={onClick} className="p-6 relative overflow-hidden group cursor-pointer hover:border-brand-orange transition-colors">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-brand-orange transition-opacity">
                <ArrowUpRight size={18} />
            </div>
            <h3 className="font-serif text-lg opacity-80 mb-6 flex items-center gap-2">
                <PieChart size={18} /> Distribution
            </h3>
            
            <div className="flex items-center gap-6">
                <div className="relative w-32 h-32 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                        {/* Background Circle */}
                        <path className="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        {/* Prospect Segment (Yellow) */}
                        <path className="text-yellow-400 drop-shadow-md" strokeDasharray={`${prospectPct}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        {/* Active Segment (Orange/Coral) - Start after Prospect */}
                        <path className="text-brand-orange drop-shadow-md" strokeDasharray={`${activePct}, 100`} strokeDashoffset={-prospectPct} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-serif font-bold text-slate-800 dark:text-white">{total}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Total</span>
                    </div>
                </div>
                
                <div className="flex flex-col gap-3 w-full">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-brand-orange shadow-sm"></span>
                            <span className="text-slate-600 dark:text-slate-300">Actifs</span>
                        </div>
                        <span className="font-bold">{active}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm"></span>
                            <span className="text-slate-600 dark:text-slate-300">Prospects</span>
                        </div>
                        <span className="font-bold">{prospect}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                            <span className="text-slate-600 dark:text-slate-300">Archivés</span>
                        </div>
                        <span className="font-bold">{archived}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

// --- Main App Component ---

const LOADING_MESSAGES = [
    "Préparation du café virtuel...",
    "Alignement des pixels au millimètre...",
    "Réveil de Franck (il a le sommeil lourd)...",
    "Chargement de la créativité...",
    "Vérification des stocks de paillettes...",
    "Initialisation du Yacht Bar..."
];

// --- Main App Component ---

const App: React.FC = () => {
    // Authentication State
    const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
    const [authChecked, setAuthChecked] = React.useState<boolean>(false);

    // App State
    const [isConfigured, setIsConfigured] = React.useState<boolean | null>(null);
    const [isBackendDown, setIsBackendDown] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isTransitioning, setIsTransitioning] = React.useState(false);
    const [loadingMessage, setLoadingMessage] = React.useState(LOADING_MESSAGES[0]);
    const [loadingText, setLoadingText] = React.useState(LOADING_MESSAGES[0]); // New state for cycling messages

    // Check authentication on mount
    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check if we have a saved token
                const savedToken = sessionStorage.getItem('marion_token');
                
                const response = await fetch('/api/auth/check', {
                    headers: savedToken ? { 'X-Marion-Token': savedToken } : {}
                });
                const data = await response.json();
                
                // If auth is configured AND user is authenticated with valid token
                if (data.configured && data.authenticated && savedToken) {
                    setAuthToken(savedToken);
                    setIsAuthenticated(true);
                }
                // Otherwise, show login/setup screen (isAuthenticated stays false)
            } catch (err) {
                // Backend might not be ready - check if it's a network error vs auth error
                console.log('Auth check failed:', err);
                // Don't auto-authenticate on error - let user try again
            }
            setAuthChecked(true);
        };
        
        checkAuth();
    }, []);

    const handleAuthenticated = async (token: string) => {
        setAuthToken(token);
        sessionStorage.setItem('marion_token', token);
        setIsAuthenticated(true);
        
        // Trigger loading animation after login
        setIsLoading(true);
        setLoadingText("Connexion réussie...");
        
        // Load data after a short delay for animation
        setTimeout(async () => {
            try {
                const res = await apiFetch('/check-status');
                const data = await res.json();
                setIsConfigured(data.configured);
                setIsBackendDown(false);
                
                if (data.configured) {
                    await loadProjects();
                    setTimeout(() => {
                        setIsLoading(false);
                    }, 2000);
                } else {
                    setIsLoading(false);
                }
            } catch (e) {
                console.error("Erreur serveur après login", e);
                setIsLoading(false);
            }
        }, 500);
    };

    // Cycle Loading Messages Effect
    React.useEffect(() => {
        if (!isLoading && !isTransitioning) return;
        
        let i = 0;
        const interval = setInterval(() => {
            i = (i + 1) % LOADING_MESSAGES.length;
            setLoadingText(LOADING_MESSAGES[i]);
        }, 1500);
        return () => clearInterval(interval);
    }, [isLoading, isTransitioning]);
    
    const [theme, setTheme] = React.useState<Theme>(() => {
        return (localStorage.getItem('marion_theme') as Theme) || 'light';
    });
    const [accentColor, setAccentColor] = React.useState<string>(() => {
        return localStorage.getItem('marion_accent_color') || '#FF7E5F';
    });
    const [currency, setCurrency] = React.useState<string>(() => {
        return localStorage.getItem('marion_currency') || 'CHF';
    });

    // Settings State (Persisted)
    const [agencyName, setAgencyName] = React.useState(() => localStorage.getItem('marion_agency_name') || 'Marion.Design');
    const [agencyWebsite, setAgencyWebsite] = React.useState(() => localStorage.getItem('marion_agency_website') || 'marion.design');
    const [tjh, setTjh] = React.useState(() => localStorage.getItem('marion_tjh') || '60');
    const [aiTone, setAiTone] = React.useState(() => localStorage.getItem('marion_ai_tone') || 'witty');
    const [briefingVocal, setBriefingVocal] = React.useState(() => localStorage.getItem('marion_briefing_vocal') === 'true');
    
    const [signatureSettings, setSignatureSettings] = React.useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('marion_signature') || '{}');
            return { mode: 'standard', name: 'Marion', role: 'Freelance Art Director', imageUrl: '', html: '', ...saved };
        } catch {
            return { mode: 'standard', name: 'Marion', role: 'Freelance Art Director', imageUrl: '', html: '' };
        }
    });

    const [notificationSettings, setNotificationSettings] = React.useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('marion_notifications') || '[]');
            if (saved.length > 0) return saved;
            return [
                { id: 'deadlines', title: 'Rappels de Deadlines', desc: '48h et 24h avant une échéance', checked: true },
                { id: 'payments', title: 'Paiement Facture', desc: 'Dès qu\'un client règle une facture', checked: true },
                { id: 'leads', title: 'Nouveau Lead', desc: 'Quand un prospect est créé ou importé', checked: false },
                { id: 'updates', title: 'Mises à jour Franck', desc: 'Nouvelles fonctionnalités de l\'IA', checked: true },
            ];
        } catch {
            return [
                { id: 'deadlines', title: 'Rappels de Deadlines', desc: '48h et 24h avant une échéance', checked: true },
                { id: 'payments', title: 'Paiement Facture', desc: 'Dès qu\'un client règle une facture', checked: true },
                { id: 'leads', title: 'Nouveau Lead', desc: 'Quand un prospect est créé ou importé', checked: false },
                { id: 'updates', title: 'Mises à jour Franck', desc: 'Nouvelles fonctionnalités de l\'IA', checked: true },
            ];
        }
    });

    // Persist settings
    React.useEffect(() => {
        localStorage.setItem('marion_theme', theme);
    }, [theme]);

    React.useEffect(() => {
        localStorage.setItem('marion_accent_color', accentColor);
    }, [accentColor]);

    React.useEffect(() => {
        localStorage.setItem('marion_currency', currency);
    }, [currency]);

    // Persist New Settings
    React.useEffect(() => localStorage.setItem('marion_agency_name', agencyName), [agencyName]);
    React.useEffect(() => localStorage.setItem('marion_agency_website', agencyWebsite), [agencyWebsite]);
    React.useEffect(() => localStorage.setItem('marion_tjh', tjh), [tjh]);
    React.useEffect(() => localStorage.setItem('marion_ai_tone', aiTone), [aiTone]);
    React.useEffect(() => localStorage.setItem('marion_briefing_vocal', String(briefingVocal)), [briefingVocal]);
    React.useEffect(() => localStorage.setItem('marion_signature', JSON.stringify(signatureSettings)), [signatureSettings]);
    React.useEffect(() => localStorage.setItem('marion_notifications', JSON.stringify(notificationSettings)), [notificationSettings]); 
    
    // Data State
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [events, setEvents] = React.useState<CalendarEvent[]>(() => {
        try {
            const saved = localStorage.getItem('marion_calendar_events');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn("Failed to load events from localStorage", e);
        }
        return MOCK_EVENTS;
    });
    
    // Persist events to localStorage
    React.useEffect(() => {
        // Filter out external events (iCal, google) before saving - they're fetched fresh
        const localEvents = events.filter(e => !e.source || e.source === 'local');
        localStorage.setItem('marion_calendar_events', JSON.stringify(localEvents));
    }, [events]);
    
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    
    // UI State
    const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
    const [showChat, setShowChat] = React.useState(false);
    const [showImporter, setShowImporter] = React.useState(false);
    const [newClientStatus, setNewClientStatus] = React.useState<ProjectStatus>(ProjectStatus.PROSPECT); 
    const [newClientEmail, setNewClientEmail] = React.useState('');
    const [newClientPhone, setNewClientPhone] = React.useState('');
    const [newClientWebsite, setNewClientWebsite] = React.useState('');
    const [isCreatingClient, setIsCreatingClient] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showMondayBriefing, setShowMondayBriefing] = React.useState(false);
    const [briefingContent, setBriefingContent] = React.useState("");
    const [isBriefingLoading, setIsBriefingLoading] = React.useState(false);
    const [showFinanceModal, setShowFinanceModal] = React.useState(false);
    const [showGlobalInvoiceModal, setShowGlobalInvoiceModal] = React.useState(false);
    const [currentInvoiceToEdit, setCurrentInvoiceToEdit] = React.useState<{invoice: Invoice, project?: Project} | null>(null);
    const [showGuide, setShowGuide] = React.useState(false);
    const [showGoalsKPIs, setShowGoalsKPIs] = React.useState(false);
    const [showDocTemplates, setShowDocTemplates] = React.useState(false);
    const [showMessagingHub, setShowMessagingHub] = React.useState(false);
    const [filter, setFilter] = React.useState<string>('Tous');
    const [showNotifCenter, setShowNotifCenter] = React.useState(false);
    const [showMediaWorkshop, setShowMediaWorkshop] = React.useState(false);
    const [isFocusMode, setIsFocusMode] = React.useState(false);
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [toasts, setToasts] = React.useState<Notification[]>([]);
    
    // Activity Tracking
    const [activities, setActivities] = React.useState<Activity[]>(() => {
        const saved = localStorage.getItem('marion_activities');
        return saved ? JSON.parse(saved) : [];
    });

    // Save activities to localStorage
    React.useEffect(() => {
        localStorage.setItem('marion_activities', JSON.stringify(activities.slice(0, 50))); // Keep last 50
    }, [activities]);

    // Add activity helper
    const addActivity = (type: Activity['type'], title: string, projectId?: string, projectName?: string, description?: string) => {
        const newActivity: Activity = {
            id: `act-${Date.now()}`,
            type,
            title,
            description,
            projectId,
            projectName,
            timestamp: new Date().toISOString()
        };
        setActivities(prev => [newActivity, ...prev].slice(0, 50));
    };
    const [interactionType, setInteractionType] = React.useState<'chase' | 'love' | null>(null);
    const hasInitialized = React.useRef(false);
    const [showScrollTop, setShowScrollTop] = React.useState(false);
    
    // Tour State
    const [showTour, setShowTour] = React.useState(false);
    const [isTourCompleted, setIsTourCompleted] = React.useState<boolean>(() => {
        return localStorage.getItem('marion_web_os_tour_completed') === 'true';
    });

    // Halo State
    const [isTorchActive, setIsTorchActive] = React.useState(false);
    const haloRef = React.useRef<HTMLDivElement>(null);

    // Halo movement effect
    React.useEffect(() => {
        if (!isTorchActive || theme !== 'dark') return;

        const handleMouseMove = (e: MouseEvent) => {
            if (haloRef.current) {
                haloRef.current.style.setProperty('--mouse-x', `${e.clientX}px`);
                haloRef.current.style.setProperty('--mouse-y', `${e.clientY}px`);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isTorchActive, theme]);

    // Drag & Drop State
    const [droppedFiles, setDroppedFiles] = React.useState<File[]>([]);
    const [showFileDispatcher, setShowFileDispatcher] = React.useState(false);
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    
    // Notes State
    const [showNotes, setShowNotes] = React.useState(false);

    // Ambient Sound State
    const [ambientUrl, setAmbientUrl] = React.useState<string | null>(null);
    const [isAmbientPlaying, setIsAmbientPlaying] = React.useState(false);
    const [ambientVolume, setAmbientVolume] = React.useState(0.5);

    const handleOpenProject = (project: Project) => {
        setLoadingMessage(`Ouverture du dossier ${project.clientName}...`);
        setIsTransitioning(true);
        // Allow fade in and brief wait
        setTimeout(() => {
            setSelectedProject(project);
            // Allow render then fade out
            setTimeout(() => {
                setIsTransitioning(false);
                setLoadingMessage("Connexion à Franck (IA)..."); // Reset default
            }, 400);
        }, 600);
    };

    // Load Projects from Backend (Desktop Folders)
    const loadProjects = async () => {
        setIsRefreshing(true);
        setIsBackendDown(false);
        
        const storedEmail = sessionStorage.getItem('infomaniak_email');
        const storedPwd = sessionStorage.getItem('infomaniak_pwd');

        try {
            const res = await apiFetch('/api/projects/scan');
            const data = await res.json();
            
            if (data.projects) {
                const loadedProjectsPromises = data.projects.map(async (folder: any) => {
                    let unreadEmailCount = 0;
                    // Only attempt to fetch email count if credentials and client email are available
                    if (storedEmail && storedPwd && folder.profile?.email) {
                        try {
                            const emailCountRes = await apiFetch('/api/email/count_for_client', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    username: storedEmail,
                                    password: storedPwd,
                                    clientEmail: folder.profile.email
                                })
                            });
                            const emailCountData = await emailCountRes.json();
                            if (emailCountData.success) {
                                unreadEmailCount = emailCountData.count;
                            } else {
                                console.warn(`Failed to get email count for ${folder.name}: ${emailCountData.error}`);
                            }
                        } catch (emailErr) {
                            console.error(`Error fetching email count for ${folder.name}:`, emailErr);
                        }
                    }

                    return {
                        id: folder.id,
                        clientName: folder.name,
                        avatarInitials: folder.name.substring(0, 2).toUpperCase(),
                        status: folder.status, 
                        phase: WorkflowPhase.DISCOVERY,
                        progress: folder.progress || 10,
                        createdAt: new Date().toISOString(),
                        profile: folder.profile || { email: '', phone: '', website: '', customFields: [] },
                        tasks: folder.tasks || [],
                        invoices: folder.invoices || [],
                        brandKit: folder.brandKit || { colors: [], fonts: [] },
                        credentials: folder.credentials || [],
                        moodboard: folder.moodboard || [],
                        // hasUnreadEmails: index === 0, // REMOVE THIS DEMO FEATURE
                        unreadEmailCount: unreadEmailCount, // ADD NEW REAL COUNT
                        archiveCategory: folder.archiveCategory // Mapped from backend
                    };
                });
                const finalLoadedProjects = await Promise.all(loadedProjectsPromises);
                setProjects(finalLoadedProjects);
            } else {
                // Fallback if no projects found (e.g. empty folder)
                setProjects([]);
            }
        } catch (e) {
            console.error("Failed to load projects", e);
            setIsBackendDown(true);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Global Shortcuts Handler
    React.useEffect(() => {
        const handleGlobalShortcuts = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                return;
            }

            // Global ESC (Close modals/views)
            if (e.key === 'Escape') {
                if (selectedProject) {
                    setSelectedProject(null);
                } else if (showChat) {
                    setShowChat(false);
                } else if (showImporter) {
                    setShowImporter(false);
                }
            }

            // / -> Search
            if (e.key === '/') {
                e.preventDefault();
                document.getElementById('dashboard-search-input')?.focus();
            }

            // n -> New Client
            if (e.key === 'n') {
                e.preventDefault();
                if (projects.length === 0) handleCreateDatabase();
                else setShowImporter(true);
            }

            // b -> Briefing
            if (e.key === 'b') {
                e.preventDefault();
                handleMorningBriefing();
            }
        };
        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, [selectedProject, showChat, showImporter, projects]);

    // Backend status check (reusable)
    const checkStatus = React.useCallback(async () => {
        try {
            const res = await apiFetch('/check-status');
            const data = await res.json();
            setIsConfigured(data.configured);
            setIsBackendDown(false);
            
            if (data.configured) {
                await loadProjects();
                if (isLoading) {
                    const timer = setTimeout(() => {
                        setIsLoading(false);
                        setTimeout(() => {
                            addNotification(
                                'Franck est en ligne',
                                'Je suis prêt à organiser ton chaos, Marion. On attaque quoi ?',
                                'ai',
                                { label: 'Parler à Franck', onClick: () => setShowChat(true) }
                            );
                        }, 800);
                    }, 2500);
                    return () => clearTimeout(timer);
                }
            } else {
                setIsLoading(false);
            }
        } catch (e) {
            console.error("Erreur serveur", e);
            setIsConfigured(false);
            setIsBackendDown(true);
            setIsLoading(false);
        }
    }, [isLoading, loadProjects]);

    // Initial Status Check & Data Loading
    React.useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
        checkStatus();
    }, [checkStatus]);

    // Theme Effect
    React.useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('dark', 'unicorn');
        if (theme === 'dark') {
            root.classList.add('dark');
        } else if (theme === 'unicorn') {
            root.classList.add('unicorn');
        }
    }, [theme]);

    // Accent Color Effect
    React.useEffect(() => {
        // Update CSS Variable for components using brand-orange
        document.documentElement.style.setProperty('--brand-color', accentColor);

        // Update Body Background if in Light Mode (Dark mode handles its own background)
        if (theme === 'light') {
            let bgGradient = 'linear-gradient(135deg, #FFE4D6 0%, #FFF8F5 50%, #FFF0F5 100%)'; // Default Orange
            
            if (accentColor === '#3B82F6') { // Blue
                bgGradient = 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 50%, #F0F9FF 100%)';
            } else if (accentColor === '#10B981') { // Green
                bgGradient = 'linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 50%, #F0FDF4 100%)';
            } else if (accentColor === '#8B5CF6') { // Purple
                bgGradient = 'linear-gradient(135deg, #EDE9FE 0%, #F5F3FF 50%, #FAF5FF 100%)';
            }

            document.body.style.backgroundImage = bgGradient;
        } else {
            document.body.style.backgroundImage = ''; // Reset for dark/unicorn modes which rely on CSS classes
        }
    }, [accentColor, theme]);

    // Scroll-to-top visibility
    React.useEffect(() => {
        const onScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Notification Helper
    const addNotification = (title: string, message: string, type: NotificationType = 'info', action?: { label: string, onClick: () => void }) => {
        const id = Date.now().toString() + Math.random().toString();
        const newNotif: Notification = {
            id,
            type,
            title,
            message,
            read: false,
            timestamp: new Date(),
            action
        };
        setNotifications(prev => [newNotif, ...prev]);
        setToasts(prev => [newNotif, ...prev]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
    const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const deleteNotif = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
    const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const clearAll = () => setNotifications([]);

    // --- Agenda Notifier Logic ---
    const notifiedEventsRef = React.useRef(new Set<string>());

    React.useEffect(() => {
        const checkSchedule = () => {
            const now = new Date();

            events.forEach(event => {
                // Parse event start time
                const [hours, minutes] = event.startTime.split(':').map(Number);
                
                // Parse event date safely to ensure Local Time (avoid UTC shifts)
                const [year, month, day] = event.date.split('-').map(Number);
                const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

                // Calculate difference in minutes
                const diffMs = eventDate.getTime() - now.getTime();
                const diffMinutes = Math.ceil(diffMs / (1000 * 60));
                const isReminder = event.id.startsWith('reminder-');

                // Rappels to-do : notification 30 min avant uniquement
                if (isReminder) {
                    if (diffMinutes === 30 && !notifiedEventsRef.current.has(event.id + '_30min')) {
                        addNotification('🔔 Rappel', `"${event.title}" dans 30 minutes.`, 'deadline');
                        notifiedEventsRef.current.add(event.id + '_30min');
                    }
                    return;
                }

                // 1. Check 15 min before (between 14 and 15 inclusive)
                if (diffMinutes === 15 && !notifiedEventsRef.current.has(event.id + '_15min')) {
                    const notifType = 'info';
                    addNotification(
                        '⏳ Bientôt',
                        `"${event.title}" commence dans 15 minutes.`, 
                        notifType
                    );
                    notifiedEventsRef.current.add(event.id + '_15min');
                }

                // 2. Check 1 min before (between 0 and 1 inclusive)
                if (diffMinutes === 1 && !notifiedEventsRef.current.has(event.id + '_1min')) {
                    const notifType = event.type === 'Deadline' ? 'deadline' : 'warning';
                    const title = event.type === 'Deadline' ? '🔥 Deadline Imminente' : '🚀 Ça commence !';
                    
                    addNotification(
                        title,
                        `"${event.title}" démarre dans 1 minute. Préparez-vous.`, 
                        notifType
                    );
                    
                    notifiedEventsRef.current.add(event.id + '_1min');

                    // Play sound only for the 1-minute warning
                    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                }
            });
        };

        // Check every 10 seconds to be precise enough without killing CPU
        const interval = setInterval(checkSchedule, 10000);
        return () => clearInterval(interval);
    }, [events]);

    // --- Invoice Notifier Logic ---
    const notifiedInvoicesRef = React.useRef(new Set<string>());

    React.useEffect(() => {
        const checkInvoices = () => {
            const now = new Date();
            // Reset time part to compare dates only
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            projects.forEach(project => {
                project.invoices.forEach(inv => {
                    if (inv.status !== 'Paid' && inv.dueDate) {
                        const dueDate = new Date(inv.dueDate);
                        
                        // Check if overdue
                        if (dueDate < today && !notifiedInvoicesRef.current.has(inv.id)) {
                            addNotification(
                                'Retard de Paiement 💸',
                                `La facture ${inv.number} de ${project.clientName} est échue depuis le ${new Date(inv.dueDate).toLocaleDateString()}.`,
                                'finance',
                                {
                                    label: 'Gérer',
                                    onClick: () => handleOpenGlobalInvoiceModal(inv, project)
                                }
                            );
                            notifiedInvoicesRef.current.add(inv.id);
                        }
                    }
                });
            });
        };

        // Check on mount and every minute
        checkInvoices();
        const interval = setInterval(checkInvoices, 60000);
        return () => clearInterval(interval);
    }, [projects]);

    // --- Intelligent Notifications: Client Inactivity ---
    const notifiedInactiveClientsRef = React.useRef(new Set<string>());

    React.useEffect(() => {
        const checkInactiveClients = () => {
            const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
            const now = Date.now();

            // Only check Active projects
            const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);

            activeProjects.forEach(project => {
                // Find the most recent activity for this project
                const projectActivities = activities.filter(a => a.projectId === project.id);
                const lastActivity = projectActivities.length > 0 
                    ? new Date(projectActivities[0].timestamp).getTime()
                    : new Date(project.createdAt).getTime();

                const inactiveDuration = now - lastActivity;

                // If inactive for more than 2 weeks and not already notified
                if (inactiveDuration > TWO_WEEKS_MS && !notifiedInactiveClientsRef.current.has(project.id)) {
                    const daysInactive = Math.floor(inactiveDuration / (24 * 60 * 60 * 1000));
                    addNotification(
                        '💤 Client en sommeil',
                        `Tu n'as pas bossé sur "${project.clientName}" depuis ${daysInactive} jours.`,
                        'warning',
                        {
                            label: 'Voir',
                            onClick: () => setSelectedProject(project)
                        }
                    );
                    notifiedInactiveClientsRef.current.add(project.id);
                }
            });
        };

        // Check once per day (or on mount)
        if (projects.length > 0 && activities.length >= 0) {
            checkInactiveClients();
        }

        // Also check every hour in case app stays open
        const interval = setInterval(checkInactiveClients, 3600000);
        return () => clearInterval(interval);
    }, [projects, activities]);

    // --- Maintenance Notifications ---
    const notifiedMaintenanceRef = React.useRef(new Set<string>());

    React.useEffect(() => {
        const checkMaintenanceAlerts = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Only check projects in Maintenance phase
            const maintenanceProjects = projects.filter(p => p.phase === WorkflowPhase.MAINTENANCE && p.maintenance);

            maintenanceProjects.forEach(project => {
                const maintenance = project.maintenance!;
                
                // 1. Check free maintenance expiring (1 month before)
                if (maintenance.freeMaintenanceEndDate) {
                    const endDate = new Date(maintenance.freeMaintenanceEndDate);
                    const oneMonthBefore = new Date(endDate);
                    oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
                    
                    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const notifKey = `maintenance_expiry_${project.id}_${maintenance.freeMaintenanceEndDate}`;
                    
                    // Alert 1 month before
                    if (today >= oneMonthBefore && today <= endDate && !notifiedMaintenanceRef.current.has(notifKey)) {
                        addNotification(
                            '🔧 Maintenance Expirante',
                            `La maintenance offerte de "${project.clientName}" expire dans ${daysUntilExpiry} jours. Pense à envoyer un mail pour proposer un contrat !`,
                            'warning',
                            {
                                label: 'Voir',
                                onClick: () => setSelectedProject(project)
                            }
                        );
                        notifiedMaintenanceRef.current.add(notifKey);
                    }
                }

                // 2. Check billing dates (1 day before)
                if (maintenance.billingDates && maintenance.billingDates.length > 0) {
                    maintenance.billingDates.forEach(dateStr => {
                        const billingDate = new Date(dateStr);
                        const daysUntilBilling = Math.ceil((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const notifKey = `billing_${project.id}_${dateStr}`;
                        
                        // Alert 1 day before
                        if (daysUntilBilling === 1 && !notifiedMaintenanceRef.current.has(notifKey)) {
                            addNotification(
                                '💰 Facturation Demain',
                                `N'oublie pas de facturer la maintenance de "${project.clientName}" demain (${new Date(dateStr).toLocaleDateString('fr-FR')}).`,
                                'finance',
                                {
                                    label: 'Facturer',
                                    onClick: () => setSelectedProject(project)
                                }
                            );
                            notifiedMaintenanceRef.current.add(notifKey);
                        }
                        
                        // Alert on the day itself
                        if (daysUntilBilling === 0 && !notifiedMaintenanceRef.current.has(notifKey + '_today')) {
                            addNotification(
                                '🔔 Facturation Aujourd\'hui',
                                `C'est le jour de facturation pour la maintenance de "${project.clientName}" !`,
                                'finance',
                                {
                                    label: 'Facturer',
                                    onClick: () => setSelectedProject(project)
                                }
                            );
                            notifiedMaintenanceRef.current.add(notifKey + '_today');
                        }
                    });
                }
            });
        };

        // Check on mount and every hour
        if (projects.length > 0) {
            checkMaintenanceAlerts();
        }
        const interval = setInterval(checkMaintenanceAlerts, 3600000); // Check every hour
        return () => clearInterval(interval);
    }, [projects]);

    const handleMorningBriefing = async () => {
        setShowMondayBriefing(true);
        setIsBriefingLoading(true);
        setBriefingContent(""); 
        
        // Calculate Stats for Briefing
        const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
        const revenue = projects.flatMap(p => p.invoices).filter(i => i.status === 'Paid').reduce((acc, i) => acc + i.amount, 0);
        // Note: In a real app, expenses would be passed here too, but for now we use project data available in scope.
        // Let's assume expenses are fetched in FinanceDashboard, so we might not have them in 'projects' state if not lifted.
        // Wait, we lifted expenses fetch inside FinanceDashboard but not to App state.
        // To keep it simple without refactoring everything, we'll focus on Revenue & Tasks which are in App state.
        
        const urgentTasks = projects.flatMap(p => p.tasks).filter(t => t.priority === 'High' && !t.completed);
        const nextEvents = events.filter(e => new Date(e.date) >= new Date()).slice(0, 3);

        const context = `
            DATETIME: ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.
            
            AGENDA (Prochains RDV): 
            ${nextEvents.map(e => `- ${e.date} à ${e.startTime}: ${e.title}`).join('\n')}
            
            PROJETS ACTIFS: ${activeProjects.length} (${activeProjects.map(p => p.clientName).join(', ')}).
            
            FINANCE (Global): ${formatCurrencyWithSymbol(Math.round(revenue), 'CHF', 0)} encaissés.
            
            URGENCES (Tâches Hautes): 
            ${urgentTasks.length > 0 ? urgentTasks.map(t => `- ${t.title}`).join('\n') : "Rien d'urgent !"}
            
            NOUVEAUX OUTILS DISPONIBLES:
            - Atelier Média (Détourage logo, posts Insta)
            - Scanner de Dépenses (Calcul du Bénéfice Net)
            - Time Tracker (Suivi du temps par client)
        `;
        
        const html = await generateBriefing(context);
        
        setIsBriefingLoading(false);
        setBriefingContent(html);

        // Vocal Briefing Logic
        if (briefingVocal) {
            // Strip HTML tags for clean reading
            const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(plainText);
                utterance.lang = 'fr-FR';
                utterance.rate = 1.1; // Slightly faster for energy
                
                // Try to find a good French voice
                const voices = window.speechSynthesis.getVoices();
                const frenchVoice = voices.find(v => v.lang.includes('fr') && !v.name.includes('Google')); // Prefer native OS voices often better
                if (frenchVoice) utterance.voice = frenchVoice;

                window.speechSynthesis.speak(utterance);
            }
        }
    };

    const handleCreateClient = async (rawName: string) => {
        const trimmed = rawName.trim();
        if (!trimmed) {
            addNotification('Nom requis', 'Merci de saisir un nom de client.', 'error');
            return;
        }

        const normalize = (s: string) =>
            s.replace(/[^a-zA-Z0-9 \-_]/g, '').trim().toLowerCase();

        const safeName = normalize(trimmed);
        if (!safeName) {
            addNotification('Nom invalide', 'Le nom du client contient uniquement des caractères spéciaux. Modifie-le légèrement.', 'error');
            return;
        }

        // Duplicate check (local)
        if (projects.some(p => normalize(p.clientName) === safeName)) {
            addNotification('Client déjà existant', `Un client nommé "${trimmed}" existe déjà.`, 'warning');
            return;
        }

        if (isCreatingClient) return;
        setIsCreatingClient(true);

        const targetFolder = newClientStatus === ProjectStatus.ACTIVE ? 'Actifs' : 'Prospects';
        const predictedPath = `${targetFolder}/${safeName}`;

        try {
            const res = await apiFetch('/api/files/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName: trimmed, status: newClientStatus })
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                if (res.status === 409 || (data.error && String(data.error).includes('already exists'))) {
                    addNotification('Client déjà présent', `Le dossier pour "${trimmed}" existe déjà sur le disque.`, 'warning');
                } else {
                    addNotification('Erreur Création', data.error || `Impossible de créer le dossier pour ${trimmed}.`, 'error');
                }
                return;
            }

            const newProject: Project = {
                id: predictedPath,
                clientName: trimmed,
                avatarInitials: trimmed.substring(0, 2).toUpperCase(),
                status: newClientStatus,
                phase: WorkflowPhase.DISCOVERY,
                progress: 0,
                createdAt: new Date().toISOString(),
                profile: { 
                    email: newClientEmail, 
                    phone: newClientPhone, 
                    website: newClientWebsite, 
                    customFields: [] 
                },
                tasks: [],
                invoices: [],
                brandKit: { colors: [], fonts: [] },
                credentials: []
            };

            setProjects(prev => [newProject, ...prev]);
            addNotification('Client Créé', `Dossier "${trimmed}" prêt dans ${targetFolder}.`, 'success');
            addActivity('project_created', `Nouveau client: ${trimmed}`, newProject.id, trimmed);
            
            // Reset form
            setNewClientEmail('');
            setNewClientPhone('');
            setNewClientWebsite('');
            setNewClientStatus(ProjectStatus.PROSPECT);
            
            setShowImporter(false); 
            setSelectedProject(newProject); 
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } catch (e) {
            console.error("Failed to create folder", e);
            addNotification('Erreur Création', `Impossible de créer le dossier pour ${trimmed}.`, 'error');
        } finally {
            setIsCreatingClient(false);
        }
    };

    const handleUpdateProject = async (updated: Project, oldId?: string) => {
        const targetId = oldId || updated.id;
        
        // Optimistic Update
        setProjects(prev => prev.map(p => p.id === targetId ? updated : p));
        if (selectedProject && selectedProject.id === targetId) {
            setSelectedProject(updated);
        }

        // Persist to Server
        try {
            const res = await apiFetch('/api/projects/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
            const data = await res.json();
            
            if (data.success && data.progress !== undefined) {
                // Update with server-calculated progress
                const finalProject = { ...updated, progress: data.progress };
                setProjects(prev => prev.map(p => p.id === targetId ? finalProject : p));
                if (selectedProject && selectedProject.id === targetId) {
                    setSelectedProject(finalProject);
                }
            }
        } catch (e) {
            console.error("Failed to save project", e);
            addNotification("Erreur Sauvegarde", "Vos modifications n'ont pas été enregistrées.", "error");
        }
    };

    const handleDeleteProject = (projectId: string) => {
        setProjects(projects.filter(p => p.id !== projectId));
        setSelectedProject(null);
    };

    const handleOpenGlobalInvoiceModal = (invoice?: Invoice, project?: Project) => {
        if (invoice) {
            setCurrentInvoiceToEdit({ invoice, project });
        } else {
            const newInv: Invoice = {
                id: `inv-${Date.now()}`,
                number: `F${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                date: new Date().toISOString().split('T')[0],
                amount: 0,
                status: 'Draft',
                type: 'Invoice', // Always Invoice
                items: [],
                clientAddress: ''
            };
            setCurrentInvoiceToEdit({ invoice: newInv });
        }
        setShowGlobalInvoiceModal(true);
    };

    const handleSaveGlobalInvoice = (invoice: Invoice, projectId: string) => {
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) return;

        const updatedProjects = [...projects];
        const targetProject = updatedProjects[projectIndex];
        
        const existingInvIndex = targetProject.invoices.findIndex(i => i.id === invoice.id);
        if (existingInvIndex >= 0) {
            targetProject.invoices[existingInvIndex] = invoice;
        } else {
            targetProject.invoices.push(invoice);
        }

        setProjects(updatedProjects);
        addNotification('Facture Enregistrée', `La facture ${invoice.number} a été sauvegardée.`, 'finance');
        addActivity('invoice_created', `Facture ${invoice.number} créée`, targetProject.id, targetProject.clientName, `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
        setShowGlobalInvoiceModal(false);
    };

    const handleAddEvent = (event: CalendarEvent) => {
        setEvents(prev => [...prev, event]);
        addNotification('Agenda Mis à jour', `"${event.title}" ajouté pour le ${event.date}.`, 'success');
        if (event.type === 'Meeting') {
            addActivity('meeting_scheduled', `Réunion: ${event.title}`, undefined, undefined, event.date);
        }
        confetti({ particleCount: 30, spread: 40, colors: ['#5BBFBA', '#F0B7A4'] });
    }

    const handleUpdateEvent = (updatedEvent: CalendarEvent) => {
        setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        addNotification('Agenda Modifié', `"${updatedEvent.title}" a été mis à jour.`, 'info');
    }

    const handleDeleteEvent = (eventId: string) => {
        const eventToDelete = events.find(e => e.id === eventId);
        
        if (eventToDelete && eventToDelete.source === 'iCal' && eventToDelete.calendarName) {
            // Delete from External Calendar via Backend
            fetch(`/api/calendar/delete?id=${encodeURIComponent(eventId)}&calendarName=${encodeURIComponent(eventToDelete.calendarName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: eventId, calendarName: eventToDelete.calendarName })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    addNotification('Agenda Synchronisé', "Événement supprimé de iCal.", 'success');
                } else {
                    addNotification('Erreur Synchro', "Impossible de supprimer sur iCal.", 'error');
                }
            })
            .catch(err => console.error("Failed to delete external event", err));
        }

        setEvents(prev => prev.filter(e => e.id !== eventId));
        addNotification('Agenda Nettoyé', "L'événement a été supprimé.", 'warning');
    }

    const handleStatusCycle = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        // Cycle only through non-archived statuses for quick toggle
        const statuses = [ProjectStatus.ACTIVE, ProjectStatus.PROSPECT, ProjectStatus.PRO_BONO, ProjectStatus.PERSO];
        const currentIndex = statuses.indexOf(project.status);
        // If current status is not in the list (e.g. Archived), start from beginning
        const nextStatus = currentIndex === -1 ? statuses[0] : statuses[(currentIndex + 1) % statuses.length];
        
        const previousStatus = project.status;

        // Optimistic update local state
        const locallyUpdated: Project = { ...project, status: nextStatus };
        setProjects(prev => prev.map(p => p.id === project.id ? locallyUpdated : p));

        // Notify UI tout de suite
        addNotification('Statut Changé', `${project.clientName} est passé en ${nextStatus}.`, 'info');
        if (nextStatus === ProjectStatus.ARCHIVED) {
            addActivity('project_archived', `${project.clientName} archivé`, project.id, project.clientName);
        } else {
            addActivity('project_status_changed', `${project.clientName} → ${nextStatus}`, project.id, project.clientName);
        }
        confetti({
            particleCount: 30,
            spread: 50,
            origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
            colors: ['#FF7E5F', '#FEB47B']
        });

        // Persister côté FS avec l’API dédiée (déplacement du dossier)
        apiFetch('/api/projects/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientName: project.clientName,
                newStatus: nextStatus
            })
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok || !data.success) {
                // Revert en cas d’erreur serveur
                setProjects(prev => prev.map(p =>
                    p.id === project.id ? { ...p, status: previousStatus } : p
                ));
                addNotification(
                    'Erreur Statut',
                    data.error || `Impossible de déplacer le dossier de "${project.clientName}".`,
                    'error'
                );
                return;
            }

            // Mettre à jour l’ID (chemin relatif) si le backend a déplacé le dossier
            if (data.path) {
                setProjects(prev => prev.map(p =>
                    p.id === project.id ? { ...p, id: data.path as string } : p
                ));
            }
        })
        .catch(err => {
            console.error('Failed to move project status', err);
            // Revert en cas d’erreur réseau
            setProjects(prev => prev.map(p =>
                p.id === project.id ? { ...p, status: previousStatus } : p
            ));
            addNotification(
                'Erreur Réseau',
                `Impossible de mettre à jour le statut de "${project.clientName}".`,
                'error'
            );
        });
    };

    const handleUnicornClick = () => {
        if (interactionType) return;
        const type = Math.random() > 0.5 ? 'chase' : 'love';
        setInteractionType(type);
        setTimeout(() => setInteractionType(null), 2000);
    };

    const handleTourComplete = () => {
        setIsTourCompleted(true);
        setShowTour(false);
        localStorage.setItem('marion_web_os_tour_completed', 'true');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    };

    const handleCreateDatabase = async () => {
        // 1. Force Init Structure (Create all root folders: Actifs, ProBono, etc.)
        try {
            await apiFetch('/api/database/init', { method: 'POST' });
        } catch (e) {
            console.error("Failed to init DB structure", e);
        }

        // 2. Create demo client
        await handleCreateClient("Dossier_Exemple");
        addNotification("Base de données Initialisée", "Le dossier 'Marion Web OS Database' est prêt sur votre Bureau avec toute l'architecture.", "success");
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    };

    // Status priority order: Active > Prospect > Perso > Pro Bono > Archived
    const statusPriority = {
        [ProjectStatus.ACTIVE]: 1,
        [ProjectStatus.PROSPECT]: 2,
        [ProjectStatus.PERSO]: 3,
        [ProjectStatus.PRO_BONO]: 4,
        [ProjectStatus.ARCHIVED]: 5
    };

    const filteredProjects = projects
        .filter(p => {
            let matchesFilter = filter === 'Tous';
            if (!matchesFilter) {
                if (filter === 'Actif') matchesFilter = p.status === ProjectStatus.ACTIVE;
                else if (filter === 'Prospect') matchesFilter = p.status === ProjectStatus.PROSPECT;
                else if (filter === 'Pro Bono') matchesFilter = p.status === ProjectStatus.PRO_BONO;
                else if (filter === 'Perso') matchesFilter = p.status === ProjectStatus.PERSO;
                else if (filter === 'Archivé') matchesFilter = p.status === ProjectStatus.ARCHIVED;
            }
            const matchesSearch = p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        })
        .sort((a, b) => {
            // First, sort by status priority
            const statusDiff = (statusPriority[a.status] || 999) - (statusPriority[b.status] || 999);
            if (statusDiff !== 0) return statusDiff;
            
            // Then, sort alphabetically by client name
            return a.clientName.localeCompare(b.clientName, 'fr');
        });

    // --- Authentication Gate ---
    if (authChecked && !isAuthenticated) {
        return (
            <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement..." />}>
                <LoginScreen onAuthenticated={handleAuthenticated} />
            </Suspense>
        );
    }

    // --- Onboarding Logic ---
    if (isConfigured === false) {
        return (
            <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de l'interface..." />}>
                <Onboarding onSetupComplete={() => setIsConfigured(true)} />
            </Suspense>
        );
    }

    // --- Backend Down Logic ---
    if (isBackendDown) {
         return (
             <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F19]">
                 <EmptyState 
                    title="Serveur Franck Indisponible" 
                    message="Impossible de joindre le cerveau de Franck. Vérifie que le terminal tourne (python franck_server.py)." 
                    icon={AlertTriangle} 
                    actionLabel="Réessayer la connexion"
                    onAction={loadProjects} 
                />
             </div>
         );
    }

    // Global Drag & Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.currentTarget === e.target) {
            setIsDraggingOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setDroppedFiles(files);
            setShowFileDispatcher(true);
        }
    };

    return (
        <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des modules..." />}>
        <div 
            className={`min-h-screen p-4 md:p-8 transition-colors duration-500 animate-in fade-in duration-1000 ${isDraggingOver ? 'ring-4 ring-emerald-500 ring-inset' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            
            <TourGuide 
                isOpen={showTour} 
                onClose={() => setShowTour(false)} 
                onComplete={handleTourComplete} 
            />

            {isFocusMode && (
                <FocusMode 
                    onExit={() => setIsFocusMode(false)} 
                    ambientUrl={ambientUrl}
                    isAmbientPlaying={isAmbientPlaying}
                    ambientVolume={ambientVolume}
                    onSetAmbientUrl={setAmbientUrl}
                    onToggleAmbient={setIsAmbientPlaying}
                    onSetVolume={setAmbientVolume}
                />
            )}

            {/* Splash Screen */}
            <SplashScreen visible={isLoading || isTransitioning} loadingText={isTransitioning ? loadingMessage : loadingText} />

            <AmbientPlayer url={ambientUrl} isPlaying={isAmbientPlaying} volume={ambientVolume} />

            {/* Halo Glow Element */}
            {isTorchActive && theme === 'dark' && (
                <div 
                    ref={haloRef}
                    className="fixed w-[400px] h-[400px] pointer-events-none z-[5] rounded-full mix-blend-screen opacity-80 transition-opacity duration-300"
                    style={{
                        left: 'var(--mouse-x)',
                        top: 'var(--mouse-y)',
                        transform: 'translate(-50%, -50%)', // This will now center it
                        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 30%, transparent 70%)',
                        boxShadow: '0 0 60px 30px rgba(255,255,255,0.05)'
                    }}
                />
            )}

            {/* Toast Container (Fixed) */}
            <div className="fixed top-20 md:top-24 right-2 md:right-8 left-2 md:left-auto z-[60] flex flex-col gap-3 w-auto md:w-full md:max-w-sm pointer-events-none">
                {toasts.map(t => (
                    <ToastItem key={t.id} notification={t} onClose={removeToast} />
                ))}
            </div>

            {/* Sticky fully transparent header (tools + actions, sans menu déroulant global) */}
            <header className="sticky top-0 z-50 flex justify-between items-center px-2 sm:px-3 md:px-6 py-2 md:py-4 mb-2 md:mb-8 bg-white/70 dark:bg-slate-900/40 md:bg-transparent md:dark:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200/50 dark:border-slate-700/30 md:border-0">
                {/* Logo + Title */}
                <div 
                    onClick={() => {
                        setSelectedProject(null);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 sm:gap-3 md:gap-5 cursor-pointer"
                >
                    <img 
                        src="/logo-marion.png" 
                        alt="Home" 
                        className="w-9 h-9 sm:w-10 sm:h-10 md:w-14 md:h-14 object-contain" 
                    />
                    {/* Title - hidden on very small screens */}
                    <div className="hidden sm:flex flex-col">
                        <h1 className="font-sans text-base sm:text-lg md:text-[26px] font-semibold text-slate-800 dark:text-white leading-tight">
                            Marion Web <span className="text-slate-400 dark:text-slate-400 font-normal hidden md:inline">OS</span>
                        </h1>
                        <p className="text-[10px] md:text-xs text-slate-400 hidden md:block">
                            Assistant Intelligent
                        </p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 bg-white/70 dark:bg-slate-800/50 md:bg-white/70 md:dark:bg-slate-800/40 px-1.5 sm:px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm md:shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:md:shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md md:-mt-2">
                    {/* Briefing */}
                    <button
                        onClick={handleMorningBriefing}
                        className="p-2 sm:px-2 sm:py-1.5 md:px-3 rounded-full text-[10px] md:text-[11px] font-semibold uppercase tracking-wide bg-gradient-to-r from-brand-orange to-pink-500 text-white"
                    >
                        <LayoutGrid size={16} className="sm:hidden" />
                        <span className="hidden sm:flex items-center gap-1.5"><LayoutGrid size={14} /> Briefing</span>
                    </button>

                    {/* Notes - visible on mobile */}
                    <Tooltip content="Notes Rapides">
                        <button
                            onClick={() => setShowNotes(true)}
                            className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors"
                        >
                            <StickyNote size={18} className="text-amber-500" />
                        </button>
                    </Tooltip>

                    {/* Settings - visible on mobile */}
                    <Tooltip content="Paramètres">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors sm:hidden"
                        >
                            <SettingsIcon size={18} className="text-slate-400" />
                        </button>
                    </Tooltip>

                    {/* Hidden on mobile - visible on tablet+ */}
                    <Tooltip content="Atelier Média">
                        <button
                            onClick={() => setShowMediaWorkshop(true)}
                            className="hidden sm:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Wand2 size={18} className="text-purple-500" />
                        </button>
                    </Tooltip>
                    <Tooltip content="Mode Focus">
                        <button
                            onClick={() => setIsFocusMode(true)}
                            className="hidden sm:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Tent size={18} className="text-blue-500" />
                        </button>
                    </Tooltip>
                    
                    {/* Hidden on mobile and tablet */}
                    <Tooltip content="Objectifs & KPIs">
                        <button
                            onClick={() => setShowGoalsKPIs(true)}
                            className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Target size={18} className="text-violet-500" />
                        </button>
                    </Tooltip>
                    <Tooltip content="Templates">
                        <button
                            onClick={() => setShowDocTemplates(true)}
                            className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <FileText size={18} className="text-orange-500" />
                        </button>
                    </Tooltip>
                    <Tooltip content="Messagerie">
                        <button
                            onClick={() => setShowMessagingHub(true)}
                            className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <MessageCircle size={18} className="text-green-500" />
                        </button>
                    </Tooltip>
                    <Tooltip content="Donner à Franck">
                        <button
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.multiple = true;
                                input.onchange = (e: any) => {
                                    const files = Array.from(e.target.files || []) as File[];
                                    if (files.length > 0) {
                                        setDroppedFiles(files);
                                        setShowFileDispatcher(true);
                                    }
                                };
                                input.click();
                            }}
                            className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Sparkles size={18} className="text-emerald-500" />
                        </button>
                    </Tooltip>

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

                    {/* Theme toggle simple (cycle) */}
                    <Tooltip content="Changer de thème">
                        <button
                            onClick={() => {
                                const next =
                                    theme === 'light'
                                        ? 'dark'
                                        : theme === 'dark'
                                        ? 'unicorn'
                                        : 'light';
                                setTheme(next as Theme);
                            }}
                            className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            {theme === 'light' && <Sun size={18} className="text-amber-400" />}
                            {theme === 'dark' && <Moon size={18} className="text-brand-orange" />}
                            {theme === 'unicorn' && <Sparkles size={18} className="text-pink-500" />}
                        </button>
                    </Tooltip>

                    {/* Settings & Help */}
                    <Tooltip content="Paramètres">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Settings size={18} />
                        </button>
                    </Tooltip>
                    <Tooltip content="Guide & Aide">
                        <button
                            onClick={() => setShowGuide(true)}
                            className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                        >
                            <HelpCircle size={18} />
                        </button>
                    </Tooltip>

                    {/* Notifications + Backend status */}
                    <div className="relative">
                        <Tooltip content="Notifications">
                            <button
                                onClick={() => setShowNotifCenter(!showNotifCenter)}
                                className="p-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-colors relative"
                            >
                                <Bell size={18} />
                                {notifications.some(n => !n.read) && (
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                                )}
                            </button>
                        </Tooltip>
                        {showNotifCenter && (
                            <div className="absolute right-0 mt-3 w-80 z-50">
                                <NotificationCenterPanel
                                    notifications={notifications}
                                    onMarkRead={markRead}
                                    onDelete={deleteNotif}
                                    onClearAll={clearAll}
                                />
                            </div>
                        )}
                    </div>

                    {isConfigured !== null && (
                        <button
                            onClick={() => {
                                if (isBackendDown) {
                                    // Try to reconnect
                                    setIsLoading(true);
                                    checkStatus();
                                } else if (isConfigured === false) {
                                    // Show onboarding to configure API key
                                    // This will trigger the Onboarding component via the isConfigured state
                                    setIsConfigured(false);
                                } else {
                                    // Franck is online, open chat
                                    setShowChat(true);
                                }
                            }}
                            className={`ml-2 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer ${
                                (isBackendDown || isConfigured === false as boolean)
                                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title={
                                isBackendDown 
                                    ? 'Cliquez pour reconnecter' 
                                    : isConfigured === false 
                                        ? 'Cliquez pour configurer Franck' 
                                        : 'Cliquez pour parler à Franck'
                            }
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                                (isBackendDown || isConfigured === false as boolean) 
                                    ? 'bg-red-500 animate-pulse' 
                                    : 'bg-emerald-500'
                            }`} />
                            {isBackendDown 
                                ? 'Reconnecter' 
                                : isConfigured === false 
                                    ? 'Configurer Franck' 
                                    : 'Franck en ligne'}
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto px-3 md:px-6 pb-20 relative z-10">
                {selectedProject ? (
                    <ClientView 
                        project={selectedProject} 
                        onBack={() => setSelectedProject(null)} 
                        onUpdateProject={handleUpdateProject}
                        onNotify={addNotification}
                        onDelete={handleDeleteProject}
                        currentTheme={theme}
                    />
                ) : (
                    <div className="animate-in fade-in slide-in-from-left-8 duration-500">
                        {/* TOP ROW: Agenda (Left), Performance & Distribution (Right) */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-8 mb-4 md:mb-8">
                            {/* Left Column: Agenda (lg:col-span-2) */}
                            <div className="lg:col-span-2 space-y-8 animate-in slide-in-from-left-8 duration-700">
                                <div id="agenda-widget">
                                    <Agenda 
                                        events={events} 
                                        onAddEvent={handleAddEvent} 
                                        onUpdateEvent={handleUpdateEvent}
                                        onDeleteEvent={handleDeleteEvent}
                                    />
                                </div>
                            </div>

                            {/* Right Column: Financial Health (lg:col-span-2) */}
                            <div className="lg:col-span-2 h-full animate-in slide-in-from-right-8 duration-700">
                                <FinancialHealthWidget 
                                    projects={projects} 
                                    currency={currency} 
                                    onClick={() => setShowFinanceModal(true)} 
                                    currentTheme={theme} 
                                    onCreateInvoice={() => handleOpenGlobalInvoiceModal()}
                                    onAddReminder={(todoId, text, remindAt) => {
                                        addNotification('Rappel ajouté', `Je te rappellerai: ${text}`, 'deadline');
                                        // Créer un événement Agenda pour le rappel (notification 30 min avant)
                                        const dateStr = `${remindAt.getFullYear()}-${String(remindAt.getMonth() + 1).padStart(2, '0')}-${String(remindAt.getDate()).padStart(2, '0')}`;
                                        const timeStr = `${String(remindAt.getHours()).padStart(2, '0')}:${String(remindAt.getMinutes()).padStart(2, '0')}`;
                                        setEvents(prev => [...prev, {
                                            id: `reminder-${todoId}`,
                                            title: text,
                                            date: dateStr,
                                            startTime: timeStr,
                                            duration: 15,
                                            type: 'Personal',
                                            source: 'local',
                                            isAppEvent: true
                                        }]);
                                    }}
                                />
                            </div>
                        </div>

                        {/* ACTIVITY WIDGET */}
                        {activities.length > 0 && (
                            <div className="mb-4 md:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Card className="p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                            <Clock size={18} className="text-brand-orange" /> Activité récente
                                        </h3>
                                        <span className="text-xs text-slate-400">{activities.length} actions</span>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
                                        {activities.slice(0, 8).map((act) => {
                                            const icons: Record<Activity['type'], React.ReactNode> = {
                                                invoice_created: <FileText size={14} className="text-emerald-500" />,
                                                invoice_paid: <DollarSign size={14} className="text-green-500" />,
                                                project_created: <FolderPlus size={14} className="text-blue-500" />,
                                                project_archived: <Archive size={14} className="text-slate-500" />,
                                                project_status_changed: <RefreshCw size={14} className="text-purple-500" />,
                                                task_completed: <CheckCircle size={14} className="text-emerald-500" />,
                                                client_updated: <User size={14} className="text-orange-500" />,
                                                brand_updated: <Palette size={14} className="text-pink-500" />,
                                                meeting_scheduled: <Calendar size={14} className="text-blue-500" />,
                                                file_uploaded: <Upload size={14} className="text-cyan-500" />,
                                            };
                                            const timeAgo = (ts: string) => {
                                                const diff = Date.now() - new Date(ts).getTime();
                                                const mins = Math.floor(diff / 60000);
                                                if (mins < 1) return "À l'instant";
                                                if (mins < 60) return `Il y a ${mins} min`;
                                                const hours = Math.floor(mins / 60);
                                                if (hours < 24) return `Il y a ${hours}h`;
                                                const days = Math.floor(hours / 24);
                                                return `Il y a ${days}j`;
                                            };
                                            return (
                                                <div 
                                                    key={act.id}
                                                    className="flex-shrink-0 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 min-w-[200px] max-w-[250px] border border-slate-100 dark:border-slate-700/50 hover:border-brand-orange/50 transition-colors cursor-default"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <div className="p-1.5 bg-white dark:bg-slate-700/80 rounded-lg shadow-sm">
                                                            {icons[act.type]}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{act.title}</p>
                                                            {act.projectName && (
                                                                <p className="text-xs text-slate-500 truncate">{act.projectName}</p>
                                                            )}
                                                            {act.description && (
                                                                <p className="text-xs text-slate-400 truncate">{act.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-2 text-right">{timeAgo(act.timestamp)}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* MIDDLE SECTION: Search, Filters, New Client & Project Cards */}
                        <div className="space-y-4 md:space-y-8 mb-4 md:mb-8">
                            <div id="dashboard-search" className="bg-white/40 dark:bg-slate-800/30 p-2 md:p-3 rounded-2xl md:rounded-3xl backdrop-blur-sm flex items-center gap-2 md:gap-3">
                                {/* Search Bar */}
                                <div className="relative flex items-center gap-2 flex-shrink-0 w-48 md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        id="dashboard-search-input"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Rechercher..." 
                                        className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-transparent dark:border-slate-700/50 focus:border-orange-300 dark:focus:border-orange-600 shadow-sm focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 w-full transition-all outline-none text-sm dark:text-slate-100 dark:placeholder-slate-400"
                                    />
                                </div>

                                {/* Filters - Scrollable */}
                                <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto flex-1 no-scrollbar">
                                    {['Actif', 'Archivé', 'Perso', 'Pro Bono', 'Prospect', 'Tous'].map(f => (
                                        <button  
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-3 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap flex-shrink-0 ${ 
                                                filter === f 
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md' 
                                                : 'bg-white dark:bg-slate-800/60 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-slate-700/80'
                                            }`}
                                        >
                                            {f.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* New Client Button */}
                                <button 
                                    id="new-client-filter-button"
                                    onClick={() => projects.length === 0 ? handleCreateDatabase() : setShowImporter(true)}
                                    className={`px-3 md:px-5 py-1.5 md:py-2 rounded-full text-white transition-all duration-300 flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase whitespace-nowrap group flex-shrink-0 ${ 
                                        projects.length === 0
                                        ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse shadow-lg'
                                        : 'bg-gradient-to-r from-[#FF7E5F] to-[#d946ef] hover:scale-105 shadow-md'
                                    }`}
                                >
                                    {projects.length === 0 ? (
                                        <>
                                            <Database size={12} /> <span className="hidden sm:inline">Database</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={12} className="group-hover:rotate-90 transition-transform duration-300" /> <span>Nouveau</span>
                                        </>
                                    )}
                                </button>

                                {/* Refresh Button */}
                                <button 
                                    onClick={loadProjects}
                                    disabled={isRefreshing}
                                    className="p-2 bg-white dark:bg-slate-800/60 rounded-xl text-slate-400 hover:text-brand-orange hover:shadow-md dark:hover:shadow-lg transition-all disabled:opacity-50 flex-shrink-0 dark:border dark:border-slate-700/50"
                                    title="Actualiser les dossiers"
                                >
                                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 animate-in slide-in-from-bottom-8 duration-500">
                                {filteredProjects.map(p => (
                                    <ProjectCard 
                                        key={p.id} 
                                        project={p} 
                                        onClick={() => handleOpenProject(p)} 
                                        onStatusCycle={(e) => handleStatusCycle(e, p)}
                                    />
                                ))}
                                
                                <div 
                                    id="new-project-card"
                                    onClick={() => setShowImporter(true)}
                                    className="group rounded-4xl p-6 border-2 border-dashed border-slate-300 dark:border-slate-600/50 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:border-brand-orange hover:text-brand-orange hover:bg-white/30 dark:hover:bg-slate-800/30 cursor-pointer transition-all min-h-[280px]"
                                >
                                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-90 transition-transform duration-300 shadow-inner">
                                        <Plus size={32} />
                                    </div>
                                    <span className="font-serif text-xl">Nouveau Projet</span>
                                    <span className="text-xs mt-2 opacity-60 font-sans">Créer un client & dossier</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            
            <footer className="max-w-7xl mx-auto mt-20 text-center text-xs text-slate-400 font-serif flex items-center justify-center gap-1 opacity-50 hover:opacity-100 transition-opacity pb-8 relative z-10">
                <span>Designer avec</span>
                <span className="text-red-400">♥</span>
                <span>par JV Automation - Copyright 2026 - v2.4.3</span>
            </footer>

            {/* Global Overlays */}
            <FranckChat 
                isOpen={showChat} 
                onClose={() => setShowChat(false)} 
                projects={projects}
                events={events}
                onAddEvent={(event) => {
                    setEvents(prev => [...prev, event]);
                    addNotification('Événement ajouté', `Franck a ajouté "${event.title}" à ton agenda`, 'success');
                }}
            />
            
            {showFileDispatcher && droppedFiles.length > 0 && (
                <FileDispatcher 
                    files={droppedFiles} 
                    onClose={() => { setShowFileDispatcher(false); setDroppedFiles([]); }}
                    onSuccess={() => {
                        setShowFileDispatcher(false);
                        setDroppedFiles([]);
                        addNotification('Classement Terminé', "Franck a rangé les fichiers avec succès !", 'ai');
                        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
                    }}
                    existingClients={projects.map(p => p.clientName)}
                />
            )}

            {/* Notes Modal */}
            {showNotes && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNotes(false)}>
                    <div className="bg-white dark:bg-slate-900/95 dark:border dark:border-slate-700/50 rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="font-serif text-2xl text-slate-800 dark:text-white">Notes Rapides</h2>
                            <button 
                                onClick={() => setShowNotes(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <span className="text-2xl text-slate-400">×</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <QuickNotes />
                        </div>
                    </div>
                </div>
            )}

            {/* Drag & Drop Visual Indicator */}
            {isDraggingOver && (
                <div className="fixed inset-0 z-[100] pointer-events-none">
                    <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 backdrop-blur-sm animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-12 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] border-4 border-emerald-500 dark:border-emerald-600 border-dashed">
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center animate-bounce">
                                    <UploadCloud size={48} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="text-center">
                                    <p className="font-serif text-3xl text-emerald-600 dark:text-emerald-400 mb-2">Déposez vos fichiers</p>
                                    <p className="text-slate-600 dark:text-slate-400">Franck va les organiser intelligemment</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Chat Button */}
            {!showChat && (
                <button
                    id="chat-btn"
                    onClick={() => setShowChat(true)}
                    className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-gradient-to-r from-brand-orange to-pink-500 text-white rounded-full shadow-[0_4px_20px_rgba(255,126,95,0.4)] flex items-center justify-center hover:scale-110 hover:rotate-3 transition-all duration-300 group border-2 border-white dark:border-slate-800 animate-in fade-in zoom-in duration-300"
                    title="Parler à Franck"
                >
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-0 group-hover:opacity-50"></div>
                    <MessageCircle size={28} className="fill-white/20" />
                </button>
            )}

            {/* Scroll to top button */}
            {showScrollTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-8 right-28 z-40 w-11 h-11 rounded-full bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600/50 shadow-[0_6px_20px_rgba(15,23,42,0.25)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.4)] flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-brand-orange transition-all duration-300"
                    aria-label="Revenir en haut de la page"
                >
                    <ArrowUp size={18} />
                </button>
            )}

            <SettingsModal 
                isOpen={showSettings}  
                onClose={() => setShowSettings(false)} 
                currentTheme={theme}
                onThemeChange={setTheme}
                currency={currency}
                onCurrencyChange={setCurrency}
                accentColor={accentColor}
                onAccentColorChange={setAccentColor}
                agencyName={agencyName}
                setAgencyName={setAgencyName}
                agencyWebsite={agencyWebsite}
                setAgencyWebsite={setAgencyWebsite}
                tjh={tjh}
                setTjh={setTjh}
                aiTone={aiTone}
                setAiTone={setAiTone}
                briefingVocal={briefingVocal}
                setBriefingVocal={setBriefingVocal}
                signatureSettings={signatureSettings}
                setSignatureSettings={setSignatureSettings}
                notificationSettings={notificationSettings}
                setNotificationSettings={setNotificationSettings}
            />

            {showMediaWorkshop && (
                <MediaStudio onClose={() => setShowMediaWorkshop(false)} />
            )}
            
            <Modal isOpen={showImporter} onClose={() => setShowImporter(false)} title="Nouveau Client">
                <div className="p-6 space-y-8">
                    {/* Input Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Identité du Client</label>
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-orange to-pink-500 rounded-2xl opacity-20 group-focus-within:opacity-100 transition-opacity duration-500 blur"></div>
                            <div className="relative bg-white dark:bg-slate-800/90 rounded-2xl p-1">
                                <input 
                                    autoFocus
                                    placeholder="Ex: Maison de la Fleur..."
                                    className="w-full text-2xl font-serif p-4 rounded-xl bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-300"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCreateClient((e.target as HTMLInputElement).value);
                                        }
                                    }}
                                    id="new-client-input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Details Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Coordonnées (Optionnel)</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input 
                                placeholder="Email"
                                value={newClientEmail}
                                onChange={(e) => setNewClientEmail(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white text-sm"
                            />
                            <input 
                                placeholder="Téléphone"
                                value={newClientPhone}
                                onChange={(e) => setNewClientPhone(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white text-sm"
                            />
                            <input 
                                placeholder="Site Web (ex: marion.com)"
                                value={newClientWebsite}
                                onChange={(e) => setNewClientWebsite(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white text-sm"
                            />
                        </div>
                    </div>
                    
                    {/* Status Selection */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Statut de démarrage</label>
                        <select 
                            value={newClientStatus} 
                            onChange={(e) => setNewClientStatus(e.target.value as ProjectStatus)}
                            className="w-full bg-slate-50 dark:bg-slate-800/80 dark:border dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white dark:placeholder-slate-400"
                        >
                            {Object.values(ProjectStatus).map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    {/* Footer / Action */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">F</div>
                            Franck préparera les dossiers.
                        </div>
                        <button 
                            onClick={() => {
                                const input = document.getElementById('new-client-input') as HTMLInputElement;
                                if (input?.value) handleCreateClient(input.value);
                            }}
                            disabled={isCreatingClient}
                            className={`px-8 py-3 bg-gradient-to-r from-brand-orange to-pink-500 text-white rounded-full font-bold text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-200/50 dark:shadow-none transition-all duration-300 ${
                                isCreatingClient
                                    ? 'opacity-70 cursor-not-allowed'
                                    : 'hover:scale-105 hover:shadow-[0_0_20px_rgba(255,126,95,0.5)]'
                            }`}
                        >
                            {isCreatingClient ? 'Création…' : 'Créer le dossier'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showFinanceModal} onClose={() => setShowFinanceModal(false)} title="" width="max-w-[95vw] w-full h-[95vh]" showCloseButton={false} noContentPadding={true}>
                <div className="h-full overflow-y-auto flex flex-col bg-slate-50 dark:bg-slate-900/95">
                    <FinanceDashboard 
                        projects={projects} 
                        onOpenInvoice={handleOpenGlobalInvoiceModal}
                        onUpdateProject={handleUpdateProject}
                        currency={currency}
                        currentTheme={theme}
                        onClose={() => setShowFinanceModal(false)}
                        onCreateInvoice={() => handleOpenGlobalInvoiceModal()}
                    />
                </div>
            </Modal>

            <Modal isOpen={showGlobalInvoiceModal} onClose={() => setShowGlobalInvoiceModal(false)} title="" width="max-w-6xl">
                {currentInvoiceToEdit && (
                    <InvoiceBuilder 
                        invoice={currentInvoiceToEdit.invoice} 
                        project={currentInvoiceToEdit.project}
                        allProjects={projects} 
                        onClose={() => setShowGlobalInvoiceModal(false)}
                        onSave={handleSaveGlobalInvoice}
                        currency={currency}
                    />
                )}
            </Modal>

            <Modal isOpen={showMondayBriefing} onClose={() => setShowMondayBriefing(false)} title="Briefing du Lundi" width="max-w-[95vw] w-full h-[95vh]">
                <div className="bg-[#fffdf9] dark:bg-slate-800/50 p-8 rounded-[32px] border border-[#f5ece0] dark:border-slate-700/50 shadow-sm dark:shadow-lg relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-900/10 rounded-bl-full flex items-start justify-end p-6">
                        <Coffee className="text-orange-200 dark:text-orange-800 w-12 h-12" />
                    </div>

                    {isBriefingLoading ? (
                        <div className="min-h-[300px] flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 bg-orange-100 dark:bg-slate-800 rounded-full flex items-center justify-center animate-bounce">
                                <Coffee className="text-brand-orange" size={28} />
                            </div>
                            <p className="font-serif text-lg text-slate-400 animate-pulse">Franck prépare votre café et analyse l'agenda...</p>
                        </div>
                    ) : (
                        <div 
                            className="briefing-content min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-700"
                            dangerouslySetInnerHTML={{ __html: briefingContent }}
                        />
                    )}
                </div>
            </Modal>

            <Modal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Guide Marion Web OS" width="max-w-6xl">
                <div className="p-4">
                    {/* ... Guide Content ... */}
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-2xl font-sans">
                        Découvrez comment cet outil a été conçu pour libérer votre créativité en automatisant le chaos.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {[ 
                            {
                                icon: Layers,
                                title: "Tableau de Bord & Yacht Bar",
                                desc: "Suivez votre activité et votre Chiffre d'Affaires avec la nouvelle Yacht Bar 🛥️ ! Visualisez votre progression vers l'objectif ultime (2.5M) en un coup d'œil."
                            },
                            {
                                icon: Calendar,
                                title: "Agenda Intelligent",
                                desc: "Un planning repensé où les événements simultanés s'affichent désormais côte à côte. Ne ratez plus rien, même lors des journées chargées."
                            },
                            {
                                icon: CheckSquare,
                                title: "Projets & Kanban Avancé",
                                desc: "Gérez vos tâches avec le nouveau Kanban : Drag & Drop (glisser-déposer), statuts personnalisables et priorités. Tout est fluide."
                            },
                            {
                                icon: Bot,
                                title: "Franck & Réunion IA",
                                desc: "Franck est votre second cerveau. Utilisez le mode 'Réunion' pour transcrire et résumer vos échanges clients automatiquement grâce à l'IA."
                            },
                            {
                                icon: Wand2,
                                title: "Atelier Média V2",
                                desc: "Détourez vos images, optimisez-les pour le Web/Instagram et exportez désormais vos créations au format SVG vectoriel."
                            },
                            {
                                icon: FolderOpen,
                                title: "Système de Fichiers",
                                desc: "Accès direct à vos dossiers locaux. Glissez-déposez pour trier, et laissez Franck organiser vos documents dans la bonne structure."
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[32px] hover:shadow-lg dark:hover:shadow-xl transition-all hover:scale-[1.02] border border-slate-100 dark:border-slate-700/50">
                                <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-slate-700 text-brand-orange flex items-center justify-center mb-6">
                                    <feature.icon size={24} />
                                </div>
                                <h3 className="font-serif text-xl font-bold mb-3 text-slate-800 dark:text-white">{feature.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-pink-50/50 dark:bg-slate-800/30 rounded-[40px] p-10 text-center border border-pink-100 dark:border-slate-700">
                        <div className="w-12 h-12 bg-pink-400 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-pink-200 dark:shadow-none animate-pulse">
                            <Heart fill="currentColor" size={20} />
                        </div>
                        <h3 className="font-serif text-3xl font-bold mb-4 text-slate-800 dark:text-white">Le Mot du Créateur</h3>
                        <p className="font-serif italic text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
                            "Ce programme a été imaginé et codé par Johan (le créateur de Franck). 
                            L'objectif ? Transformer le chaos administratif en un espace zen et parfaitement rangé. 
                            Fini la charge mentale de l'organisation, place à la sérénité et à la clarté."
                        </p>
                        
                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800/60 rounded-full shadow-sm dark:shadow-md border border-slate-200 dark:border-slate-700/50 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">
                            <Sparkles size={14} className="text-brand-orange" />
                            Signature de design par Johan Vila Automation
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Goals & KPIs Modal */}
            {showGoalsKPIs && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" /></div>}>
                    <GoalsKPIs 
                        projects={projects}
                        currency={currency}
                        onClose={() => setShowGoalsKPIs(false)}
                    />
                </Suspense>
            )}

            {/* Document Templates Modal */}
            {showDocTemplates && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>}>
                    <DocumentTemplates 
                        onClose={() => setShowDocTemplates(false)}
                    />
                </Suspense>
            )}

            {/* Messaging Hub Modal */}
            {showMessagingHub && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>}>
                    <MessagingHub 
                        projects={projects}
                        onClose={() => setShowMessagingHub(false)}
                    />
                </Suspense>
            )}

            <PWAInstallPrompt />
            <BugReporter />
            <WhatsNew />
        </div>
        </Suspense>
    );
};

export default App;