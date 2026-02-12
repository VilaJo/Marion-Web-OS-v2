import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, Clock, Sparkles, Pizza, Ship, Mic, ListTodo, RefreshCw } from 'lucide-react';
import { Project, Expense } from '../types';
import { Card } from './Shared';
import { formatCurrency } from '../utils';
import { useExpenses } from '../services/queries';

interface FinancialHealthWidgetProps {
    projects: Project[];
    currency?: string;
    onClick?: () => void;
    currentTheme?: string;
    onCreateInvoice?: () => void;
    onCreateEstimate?: () => void;
    onAddReminder?: (todoId: string, text: string, remindAt: Date) => void;
}

const YACHT_PRICE = 300000; // Target Price for the Yacht

export const FinancialHealthWidget: React.FC<FinancialHealthWidgetProps> = ({
    projects,
    currency = 'CHF',
    onClick,
    currentTheme,
    onCreateInvoice,
    onCreateEstimate,
    onAddReminder
}) => {
    const { data: expenses = [] } = useExpenses();
    const [rates, setRates] = useState<Record<string, number>>({});
    const [isLoadingRates, setIsLoadingRates] = useState(true);
    // Persist view preference in localStorage
    const [showTodo, setShowTodo] = useState(() => {
        try {
            return localStorage.getItem('marion_dashboard_view') === 'todo';
        } catch { return false; }
    });
    const [isSwitchingView, setIsSwitchingView] = useState(false);

    // Save view preference when it changes
    useEffect(() => {
        try {
            localStorage.setItem('marion_dashboard_view', showTodo ? 'todo' : 'finance');
        } catch { /* ignore */ }
    }, [showTodo]);
    const [isListening, setIsListening] = useState(false);
    const [newTodo, setNewTodo] = useState('');
    type TodoCategory = 'Client' | 'Finance' | 'Perso';
    const [todos, setTodos] = useState<{ id: string; text: string; done: boolean; remindAt?: string; category?: TodoCategory }[]>(() => {
        try {
            const saved = localStorage.getItem('marion_daily_todos');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Check if saved date is today — reset if it's a new day
                const savedDate = localStorage.getItem('marion_daily_todos_date');
                const today = new Date().toISOString().slice(0, 10);
                if (savedDate === today && Array.isArray(parsed)) return parsed;
                // New day: keep uncompleted tasks, clear completed ones
                if (Array.isArray(parsed)) return parsed.filter((t: any) => !t.done);
            }
        } catch { /* ignore */ }
        return [];
    });
    const [todoCategoryFilter, setTodoCategoryFilter] = useState<TodoCategory | 'all'>('all');
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
    const [editingTodoText, setEditingTodoText] = useState('');
    const [editingTodoTime, setEditingTodoTime] = useState('');
    const [editingTodoCategory, setEditingTodoCategory] = useState<TodoCategory>('Perso');
    const [newTodoCategory, setNewTodoCategory] = useState<TodoCategory>('Perso');
    const editInputRef = useRef<HTMLInputElement>(null);

    // Persist todos to localStorage on every change
    useEffect(() => {
        try {
            localStorage.setItem('marion_daily_todos', JSON.stringify(todos));
            localStorage.setItem('marion_daily_todos_date', new Date().toISOString().slice(0, 10));
        } catch { /* ignore */ }
    }, [todos]);

    useEffect(() => {
        if (editingTodoId) {
            const todo = todos.find(t => t.id === editingTodoId);
            setEditingTodoText(todo?.text ?? '');
            setEditingTodoTime(todo?.remindAt ?? '');
            setEditingTodoCategory(todo?.category ?? 'Perso');
            setTimeout(() => editInputRef.current?.focus(), 50);
        }
    }, [editingTodoId, todos]);

    const saveTodoEdit = (id: string) => {
        const trimmed = editingTodoText.trim();
        if (trimmed) {
            setTodos(prev => prev.map(t =>
                t.id === id
                    ? { ...t, text: trimmed, remindAt: editingTodoTime || undefined, category: editingTodoCategory }
                    : t
            ));
        }
        setEditingTodoId(null);
    };

    const formatTimeLabel = (remindAt: string) => {
        if (!remindAt) return null;
        const [h, m] = remindAt.split(':');
        return `${h}h${m || '00'}`;
    };

    // Helper to get ISO code from symbol
    const getIsoCurrency = (curr: string) => {
        if (!curr) return 'CHF';
        if (curr === '€') return 'EUR';
        if (curr === '$') return 'USD';
        if (curr === '£') return 'GBP';
        return curr; 
    };

    const targetIsoCurrency = getIsoCurrency(currency);

    // --- Simple reminder parsing & creation ---
    const parseReminderText = (input: string): { text: string; remindAt: Date } => {
        const now = new Date();
        let hours = now.getHours() + 1;
        let minutes = 0;

        const timeMatch = input.match(/(\d{1,2})\s*h(?:\s*(\d{2}))?/i);
        if (timeMatch) {
            hours = Math.min(23, Math.max(0, Number(timeMatch[1])));
            if (timeMatch[2]) minutes = Math.min(59, Math.max(0, Number(timeMatch[2])));
        }

        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        return { text: input, remindAt: target };
    };

    const addTodoFromText = (raw: string, category: TodoCategory = 'Perso') => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        const { text, remindAt } = parseReminderText(trimmed);
        const id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const remindAtStr = `${String(remindAt.getHours()).padStart(2, '0')}:${String(remindAt.getMinutes()).padStart(2, '0')}`;

        setTodos(prev => [...prev, { id, text, done: false, remindAt: remindAtStr, category }]);
        if (onAddReminder) onAddReminder(id, text, remindAt);
        setNewTodo('');
    };

    const handleVoiceCapture = () => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("La dictée vocale n'est pas supportée par ce navigateur.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            addTodoFromText(transcript);
        };

        recognition.start();
    };

    useEffect(() => {
        // Fetch Exchange Rates (Base CHF)
        const fetchRates = async () => {
            try {
                const res = await fetch('https://open.er-api.com/v6/latest/CHF');
                const data = await res.json();
                if (data && data.rates) {
                    setRates(data.rates);
                }
            } catch (e) {
                console.error("Failed to fetch rates", e);
            } finally {
                setIsLoadingRates(false);
            }
        };
        fetchRates();
    }, []);

    // Conversion Helper
    const convert = (amount: number, fromCurrency: string = 'CHF') => {
        if (!amount) return 0;
        const fromIso = getIsoCurrency(fromCurrency);
        
        // If same currency, return as is
        if (fromIso === targetIsoCurrency) return amount;
        
        // If we have rates, convert
        if (rates[targetIsoCurrency] && rates[fromIso]) {
            // Convert to Base (CHF) then to Target
            // Formula: Amount / Rate(From) * Rate(To)
            // Since Base is CHF, Rate(CHF) is 1.
            const inBase = amount / rates[fromIso];
            return inBase * rates[targetIsoCurrency];
        }
        
        return amount; // Fallback if rates missing
    };

    // Aggregation Logic (Yearly)
    const now = new Date();
    const currentYear = now.getFullYear();

    const allInvoices = projects.flatMap(p => p.invoices);
    
    // Revenue (Paid this year)
    const totalRevenue = allInvoices
        .filter(i => i.status === 'Paid' && i.type === 'Invoice' && new Date(i.date).getFullYear() === currentYear)
        .reduce((sum, i) => sum + convert(i.amount, i.currency || 'CHF'), 0);

    // Pending (Sent but not paid)
    const pendingRevenue = allInvoices
        .filter(i => (i.status === 'Pending' || i.status === 'Draft' || i.status === 'Partial') && i.type === 'Invoice')
        .reduce((sum, i) => {
            if (i.status === 'Partial' && i.payments) {
                const paidAmount = i.payments.reduce((s, p) => s + p.amount, 0);
                return sum + convert(i.amount - paidAmount, i.currency || 'CHF');
            }
            return sum + convert(i.amount, i.currency || 'CHF');
        }, 0);

    // Expenses (This year)
    // Assumption: Expenses are in CHF unless we add currency to Expense type. Defaulting to CHF.
    const totalExpenses = expenses
        .filter(e => new Date(e.date).getFullYear() === currentYear)
        .reduce((sum, e) => sum + convert(e.amount, 'CHF'), 0);

    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // Determine main color gradient based on profit
    const profitGradient = netProfit >= 0 
        ? 'from-emerald-400 to-green-600' // Greenish for positive
        : 'from-red-400 to-red-600';     // Reddish for negative

    const profitTextGradient = netProfit >= 0 
        ? 'bg-gradient-to-r from-emerald-600 to-green-800 bg-clip-text text-transparent'
        : 'bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent';

    const yachtProgress = Math.min(100, Math.max(0, (netProfit / YACHT_PRICE) * 100));

    // Custom Swiss Formatter (Apostrophe as thousands separator)
    const formatSwiss = (num: number, curr: string) => {
        const numPart = formatCurrency(num, 2);
        
        // Reconstruct with currency symbol (Standard Swiss format: CURRENCY_CODE AMOUNT)
        return `${curr} ${numPart}`;
    };

    // Formatter for compact numbers (e.g. "1.2M") - keep standard or custom?
    // Let's keep standard compact for small space, but maybe apply apostrophe if not compact?
    // The previous code used notation: 'compact'.
    // "1.2M" doesn't need apostrophes.
    // But "12'345" does.
    // Let's use formatSwiss for the Big Numbers (Profit) and standard/compact for small ones if space is tight.
    // User asked "notamment sur le chiffre d'affaire".
    // Total Revenue is "Entrées".
    // Let's use formatSwiss for Net Profit (Big) and the metrics grid (Revenue, Expenses, Pending) IF they fit.
    // The previous code used `notation: 'compact'` for metrics. "1.2k"
    // If the user wants apostrophes, they probably want full numbers or at least Swiss style.
    // Let's stick to 'compact' for the metrics grid to avoid layout breaking, but use Swiss format for the BIG Net Profit display.
    
    // Actually, user said "notamment sur le chiffre d'affaire".
    // Let's try to use full swiss format for Metrics if possible, or keep compact but ensure apostrophes if > 1000 and not abbreviated.
    // Compact notation doesn't usually use thousands separators (it uses k, M).
    // So "1'200" vs "1.2k".
    // I will apply `formatSwiss` to the BIG `netProfit` display.
    // For `totalRevenue` etc, I'll switch to `formatSwiss` if I can, but `notation: 'compact'` was used. 
    // I'll assume they want the full number formatted nicely if they ask for apostrophes.
    // I'll change metrics to use `formatSwiss` too, removing 'compact' notation. This is "cleaner" for accounting.

    return (
        <Card 
            onClick={showTodo ? undefined : onClick}
            className="relative overflow-hidden group cursor-pointer hover:border-brand-orange transition-all duration-500 h-full min-h-[320px] flex flex-col justify-between p-6 rounded-4xl bg-gradient-to-br from-white to-orange-50 dark:from-slate-800 dark:to-slate-900 border-white/60 dark:border-white/5" // Default light background
        >
            {/* Conditional Vibrant Backgrounds - Marion's touch */}
            <div className={`absolute inset-0 z-0 opacity-10 transition-opacity duration-500
                ${currentTheme === 'unicorn' 
                    ? 'bg-gradient-to-br from-pink-300 to-purple-400'
                    : netProfit >= 0 ? 'bg-gradient-to-br from-emerald-300 to-blue-400'
                    : 'bg-gradient-to-br from-red-300 to-orange-400'
                }
            `}></div>

            {/* Background Decor - Dynamic and more playful */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-brand-orange/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-purple-400/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {!showTodo && (
                            <>
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Wallet size={18} />
                                </div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    Santé Financière ({currentYear})
                                    {currentTheme === 'unicorn' && netProfit >= 0 && <Sparkles size={16} className="text-pink-400" />}
                                    {currentTheme === 'unicorn' && netProfit < 0 && <Pizza size={16} className="text-red-400" />}
                                </h3>
                            </>
                        )}
                        {showTodo && (
                            <div className="flex flex-col">
                                <h3 className="text-lg md:text-xl font-bold bg-gradient-to-r from-pink-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                                    ✨ Ma petite to‑do du jour
                                </h3>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Dicte ou écris, on te rappelle à l’heure.
                                </span>
                            </div>
                        )}
                    </div>
                    {/* Quick Action: création de facture (vue finances uniquement) */}
                    {!showTodo && (
                        <div className="flex gap-2 mt-3 relative z-50" onClick={(e) => e.stopPropagation()}>
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    e.preventDefault();
                                    if (onCreateInvoice) onCreateInvoice(); 
                                }} 
                                className="px-3 py-1.5 rounded-lg bg-brand-orange text-white text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm hover:shadow-md"
                            >
                                Facture +
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <button
                        type="button"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (isSwitchingView) return;
                            setIsSwitchingView(true);
                            setTimeout(() => {
                                setShowTodo(prev => !prev);
                                setIsSwitchingView(false);
                            }, 450);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 hover:border-brand-orange hover:text-brand-orange transition-all shadow-sm"
                    >
                        <ListTodo size={14} />
                        {showTodo ? 'Vue Finances' : 'Vue To‑Do'}
                    </button>
                    {!showTodo && (
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 transition-all
                            ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                            <TrendingUp size={14} /> {margin}% Marge
                        </div>
                    )}
                </div>
            </div>

            {isSwitchingView ? (
                <div className="relative z-10 flex-1 flex items-center justify-center py-6">
                    <div className="flex flex-col items-center gap-4">
                        {/* Mini Marion loader (reprend le style du SplashScreen) */}
                        <div className="relative w-28 h-28 flex items-center justify-center">
                            {/* Ring track */}
                            <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800" />
                            {/* Outer spinner */}
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-orange border-r-purple-500 animate-spin" />
                            {/* Inner reverse spinner */}
                            <div className="absolute inset-3 rounded-full border-4 border-transparent border-b-brand-orange border-l-pink-400 animate-[spin_3s_linear_infinite_reverse]" />
                            {/* Logo */}
                            <div className="w-14 h-14 relative z-10 animate-pulse">
                                <img 
                                    src="/logo-marion.png" 
                                    alt="Marion" 
                                    className="w-full h-full object-contain drop-shadow-lg" 
                                />
                            </div>
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
                            Marion réorganise ta vue…
                        </p>
                    </div>
                </div>
            ) : !showTodo ? (
                <>
                    {/* Main KPI - Animated and impactful */}
                    <div className="relative z-10 mb-4 flex flex-col items-center justify-center flex-grow">
                        <div className={`font-serif font-black tracking-tight text-5xl md:text-6xl lg:text-7xl drop-shadow-lg transition-all duration-500 ${profitTextGradient} ${isLoadingRates ? 'opacity-50 blur-sm' : ''}`}>
                            {formatSwiss(netProfit, targetIsoCurrency)}
                        </div>
                        <div className="text-sm font-medium text-slate-400 mt-1 flex items-center gap-2">
                            Bénéfice Net 
                            {targetIsoCurrency !== 'CHF' && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">Approx</span>}
                        </div>
                    </div>

                    {/* Yacht Bar */}
                    <div className="relative z-10 mb-6 px-2">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest flex items-center gap-1">
                                <Ship size={12} /> Yacht Bar
                            </span>
                            <span className="text-[10px] font-bold text-cyan-600">{yachtProgress.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-visible relative">
                            <div 
                                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-1000 relative"
                                style={{ width: `${yachtProgress}%` }}
                            >
                                <div className="absolute -right-3 -top-3 text-lg filter drop-shadow-md animate-bounce" style={{ animationDuration: '2s' }}>
                                    <div className="transform scale-x-[-1]">🛥️</div>
                                </div>
                            </div>
                        </div>
                        <div className="text-right mt-1">
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Objectif: {(YACHT_PRICE / 1000000).toFixed(1)}M</span>
                        </div>
                    </div>

                    {/* Mini Graph (More visible and colorful) */}
                    <div className="absolute top-1/2 left-0 w-full h-1/2 flex items-end gap-0.5 opacity-20 pointer-events-none transform -translate-y-1/2">
                        {[50, 60, 45, 70, 80, 55, 75, 90, 65, 85, 70, 95].map((h, i) => ( // More data points for visual interest
                            <div key={i} className={`flex-1 rounded-t-sm transition-all duration-300 group-hover:scale-y-110
                                ${netProfit >= 0 ? 'bg-gradient-to-t from-emerald-300 to-green-500' : 'bg-gradient-to-t from-red-300 to-orange-500'}`} style={{ height: `${h}%` }}></div>
                        ))}
                    </div>

                    {/* Metrics Grid */}
                    <div className="relative z-10 grid grid-cols-3 gap-4 pt-6 border-t border-white/20 dark:border-slate-700/50">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <ArrowUpRight size={12} className="text-emerald-500" /> Entrées
                            </span>
                            <span className="tabular-nums font-bold text-slate-700 dark:text-slate-200 text-lg truncate">
                                {formatSwiss(totalRevenue, targetIsoCurrency)}
                            </span>
                        </div>
                        
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <ArrowDownRight size={12} className="text-red-500" /> Sorties
                            </span>
                            <span className="tabular-nums font-bold text-slate-700 dark:text-slate-200 text-lg truncate">
                                {formatSwiss(totalExpenses, targetIsoCurrency)}
                            </span>
                        </div>

                        <div className="flex flex-col pl-4 border-l border-white/20 dark:border-slate-700/50">
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Clock size={12} /> En Attente
                            </span>
                            <span className="tabular-nums font-bold text-orange-500 text-lg truncate">
                                {formatSwiss(pendingRevenue, targetIsoCurrency)}
                            </span>
                        </div>
                    </div>
                </>
            ) : null}

            {/* To‑Do Mode */}
            {!isSwitchingView && showTodo && (
                <div className="relative z-10 mt-2 flex flex-col gap-4 flex-1">
                    {/* Input + Voice */}
                    <div
                        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-50 to-amber-50 dark:from-pink-900/20 dark:to-amber-900/20 border-2 border-pink-200/60 dark:border-pink-500/30 px-3 py-2.5 shadow-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <input
                            value={newTodo}
                            onChange={(e) => setNewTodo(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addTodoFromText(newTodo, newTodoCategory)}
                            placeholder="Rappelle-moi d'envoyer un email à Johan avant 14h…"
                            className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        />
                        <button
                            type="button"
                            onClick={() => addTodoFromText(newTodo, newTodoCategory)}
                            className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-brand-orange to-pink-500 text-white hover:shadow-md hover:scale-[1.02] transition-all"
                        >
                            Ajouter
                        </button>
                        <button
                            type="button"
                            onClick={handleVoiceCapture}
                            className={`p-2 rounded-full transition-all ${isListening ? 'bg-pink-400 text-white shadow-lg scale-110' : 'bg-white/90 dark:bg-slate-800/90 text-pink-500 border-2 border-pink-200 dark:border-pink-500/50 hover:bg-pink-100 dark:hover:bg-pink-900/30'}`}
                            title="Dicter un rappel"
                        >
                            <Mic size={16} />
                        </button>
                    </div>

                    {/* Todo list - cartes colorées */}
                    <div className="flex-1 rounded-2xl p-3 overflow-y-auto min-h-[180px]">
                        {todos.filter(t => todoCategoryFilter === 'all' || t.category === todoCategoryFilter).length === 0 ? (
                            <div className="h-32 flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-violet-50 to-cyan-50 dark:from-violet-900/20 dark:to-cyan-900/20 border-2 border-dashed border-violet-200 dark:border-violet-500/30">
                                <span className="text-2xl">🌱</span>
                                <span className="text-sm font-medium text-violet-600 dark:text-violet-300">Aucun rappel pour l’instant</span>
                                <span className="text-xs text-slate-500">Parle ou écris pour ajouter un rappel</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {todos.filter(t => todoCategoryFilter === 'all' || t.category === todoCategoryFilter).map((todo, idx) => {
                                    const colorSets = [
                                        'from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 border-rose-200/80 dark:border-rose-500/30',
                                        'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-amber-200/80 dark:border-amber-500/30',
                                        'from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 border-emerald-200/80 dark:border-emerald-500/30',
                                        'from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30 border-sky-200/80 dark:border-sky-500/30',
                                        'from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border-violet-200/80 dark:border-violet-500/30',
                                    ];
                                    const accentColors = ['text-rose-600 dark:text-rose-300', 'text-amber-600 dark:text-amber-300', 'text-emerald-600 dark:text-emerald-300', 'text-sky-600 dark:text-sky-300', 'text-violet-600 dark:text-violet-300'];
                                    const set = colorSets[idx % colorSets.length];
                                    const accent = accentColors[idx % accentColors.length];
                                    return (
                                        <div
                                            key={todo.id}
                                            className={`flex items-start gap-3 rounded-xl px-3 py-2.5 bg-gradient-to-r ${set} border shadow-sm cursor-pointer`}
                                            onClick={() => editingTodoId !== todo.id && setEditingTodoId(todo.id)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={todo.done}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    setTodos(prev =>
                                                        prev.map(t =>
                                                            t.id === todo.id ? { ...t, done: !t.done } : t
                                                        )
                                                    );
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-1.5 w-4 h-4 rounded border-2 border-slate-300 text-pink-500 focus:ring-pink-400 shrink-0"
                                            />
                                            <div className="flex-1 min-w-0" onClick={(e) => { if (editingTodoId === todo.id) e.stopPropagation(); }}>
                                                {editingTodoId === todo.id ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            ref={editInputRef}
                                                            type="text"
                                                            value={editingTodoText}
                                                            onChange={(e) => setEditingTodoText(e.target.value)}
                                                            onBlur={() => saveTodoEdit(todo.id)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveTodoEdit(todo.id);
                                                                if (e.key === 'Escape') {
                                                                    setEditingTodoId(null);
                                                                    setEditingTodoText('');
                                                                }
                                                            }}
                                                            className="w-full text-sm font-medium bg-white/70 dark:bg-slate-800/70 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-pink-400"
                                                        />
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[10px] font-bold text-slate-500">Catégorie :</span>
                                                            {(['Client', 'Finance', 'Perso'] as const).map((cat) => (
                                                                <button key={cat} type="button" onClick={() => setEditingTodoCategory(cat)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${editingTodoCategory === cat ? 'bg-brand-orange text-white' : 'bg-white/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{cat}</button>
                                                            ))}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Clock size={14} className={accent} />
                                                            <input
                                                                type="time"
                                                                value={editingTodoTime || '12:00'}
                                                                onChange={(e) => setEditingTodoTime(e.target.value)}
                                                                className="text-xs font-semibold bg-white/70 dark:bg-slate-800/70 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-pink-400"
                                                            />
                                                            <span className="text-[10px] text-slate-500">(rappel 30 min avant)</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-sm font-medium ${todo.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-100'}`}>{todo.text}</span>
                                                        {todo.category && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">{todo.category}</span>
                                                        )}
                                                    </div>
                                                )}
                                                {todo.remindAt && editingTodoId !== todo.id && (
                                                    <div className={`text-[10px] font-semibold mt-1 flex items-center gap-1 ${accent}`}>
                                                        <Clock size={10} /> Vers {formatTimeLabel(todo.remindAt)} · rappel 30 min avant
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
};
