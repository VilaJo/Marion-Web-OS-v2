import React, { useState, useEffect } from 'react';
import { Goal, KPI, Project, Invoice } from '../types';
import { Card, Modal } from './Shared';
import { formatCurrency } from '../utils';
import {
    Target,
    TrendingUp,
    TrendingDown,
    Users,
    DollarSign,
    Calendar,
    Plus,
    Edit2,
    Trash2,
    CheckCircle,
    Circle,
    BarChart3,
    PieChart,
    ArrowRight,
    Sparkles,
    Trophy,
    Zap,
    X,
    ChevronDown,
    Check
} from 'lucide-react';

interface GoalsKPIsProps {
    projects: Project[];
    currency?: string;
    onClose: () => void;
}

export const GoalsKPIs: React.FC<GoalsKPIsProps> = ({ projects, currency = 'CHF', onClose }) => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [showAddGoal, setShowAddGoal] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('yearly');
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

    // Load goals from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('marion_goals');
        if (saved) {
            setGoals(JSON.parse(saved));
        } else {
            // Initialize with default goals
            const defaultGoals: Goal[] = [
                {
                    id: 'goal-1',
                    title: 'Chiffre d\'affaires annuel',
                    type: 'revenue',
                    target: 100000,
                    current: 0,
                    unit: currency,
                    period: 'yearly',
                    year: currentYear,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'goal-2',
                    title: 'Nouveaux clients',
                    type: 'clients',
                    target: 12,
                    current: 0,
                    unit: 'clients',
                    period: 'yearly',
                    year: currentYear,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'goal-3',
                    title: 'Projets terminés',
                    type: 'projects',
                    target: 20,
                    current: 0,
                    unit: 'projets',
                    period: 'yearly',
                    year: currentYear,
                    createdAt: new Date().toISOString()
                }
            ];
            setGoals(defaultGoals);
        }
    }, []);

    // Save goals to localStorage
    useEffect(() => {
        if (goals.length > 0) {
            localStorage.setItem('marion_goals', JSON.stringify(goals));
        }
    }, [goals]);

    // Calculate KPIs from projects data
    const calculateKPIs = (): KPI[] => {
        const now = new Date();
        const thisYear = now.getFullYear();
        const thisMonth = now.getMonth();
        const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

        // Revenue calculations
        const allInvoices = projects.flatMap(p => p.invoices || []);
        const paidInvoices = allInvoices.filter(inv => inv.status === 'Paid');
        
        const thisYearRevenue = paidInvoices
            .filter(inv => new Date(inv.date).getFullYear() === thisYear)
            .reduce((sum, inv) => sum + inv.amount, 0);
        
        const lastYearRevenue = paidInvoices
            .filter(inv => new Date(inv.date).getFullYear() === thisYear - 1)
            .reduce((sum, inv) => sum + inv.amount, 0);

        const thisMonthRevenue = paidInvoices
            .filter(inv => {
                const d = new Date(inv.date);
                return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
            })
            .reduce((sum, inv) => sum + inv.amount, 0);

        const lastMonthRevenue = paidInvoices
            .filter(inv => {
                const d = new Date(inv.date);
                return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
            })
            .reduce((sum, inv) => sum + inv.amount, 0);

        // Client calculations
        const activeClients = projects.filter(p => p.status === 'Active').length;
        const totalClients = projects.filter(p => p.status !== 'Perso').length;
        
        const thisYearClients = projects.filter(p => {
            const created = new Date(p.createdAt);
            return created.getFullYear() === thisYear;
        }).length;

        // Project calculations
        const completedProjects = projects.filter(p => p.status === 'Archived').length;
        const pendingInvoicesAmount = allInvoices
            .filter(inv => inv.status === 'Pending')
            .reduce((sum, inv) => sum + inv.amount, 0);

        // Average invoice value
        const avgInvoiceValue = paidInvoices.length > 0 
            ? thisYearRevenue / paidInvoices.filter(inv => new Date(inv.date).getFullYear() === thisYear).length 
            : 0;

        return [
            {
                id: 'kpi-revenue-year',
                name: 'CA Annuel',
                value: thisYearRevenue,
                previousValue: lastYearRevenue,
                unit: currency,
                trend: thisYearRevenue > lastYearRevenue ? 'up' : thisYearRevenue < lastYearRevenue ? 'down' : 'stable',
                category: 'finance'
            },
            {
                id: 'kpi-revenue-month',
                name: 'CA Mensuel',
                value: thisMonthRevenue,
                previousValue: lastMonthRevenue,
                unit: currency,
                trend: thisMonthRevenue > lastMonthRevenue ? 'up' : thisMonthRevenue < lastMonthRevenue ? 'down' : 'stable',
                category: 'finance'
            },
            {
                id: 'kpi-pending',
                name: 'En attente',
                value: pendingInvoicesAmount,
                unit: currency,
                trend: 'stable',
                category: 'finance'
            },
            {
                id: 'kpi-avg-invoice',
                name: 'Facture moyenne',
                value: avgInvoiceValue,
                unit: currency,
                trend: 'stable',
                category: 'finance'
            },
            {
                id: 'kpi-active-clients',
                name: 'Clients actifs',
                value: activeClients,
                unit: 'clients',
                trend: 'stable',
                category: 'clients'
            },
            {
                id: 'kpi-new-clients',
                name: 'Nouveaux clients',
                value: thisYearClients,
                unit: 'cette année',
                trend: 'up',
                category: 'clients'
            },
            {
                id: 'kpi-total-clients',
                name: 'Total clients',
                value: totalClients,
                unit: 'clients',
                trend: 'stable',
                category: 'clients'
            },
            {
                id: 'kpi-completed',
                name: 'Projets terminés',
                value: completedProjects,
                unit: 'projets',
                trend: 'stable',
                category: 'productivity'
            }
        ];
    };

    const kpis = calculateKPIs();

    // Update goal progress based on actual data
    const getGoalProgress = (goal: Goal): number => {
        const now = new Date();
        const allInvoices = projects.flatMap(p => p.invoices || []);
        const paidInvoices = allInvoices.filter(inv => inv.status === 'Paid');

        switch (goal.type) {
            case 'revenue':
                if (goal.period === 'yearly') {
                    return paidInvoices
                        .filter(inv => new Date(inv.date).getFullYear() === goal.year)
                        .reduce((sum, inv) => sum + inv.amount, 0);
                } else if (goal.period === 'monthly' && goal.month) {
                    return paidInvoices
                        .filter(inv => {
                            const d = new Date(inv.date);
                            return d.getFullYear() === goal.year && d.getMonth() + 1 === goal.month;
                        })
                        .reduce((sum, inv) => sum + inv.amount, 0);
                }
                break;
            case 'clients':
                if (goal.period === 'yearly') {
                    return projects.filter(p => {
                        const created = new Date(p.createdAt);
                        return created.getFullYear() === goal.year && p.status !== 'Perso';
                    }).length;
                }
                break;
            case 'projects':
                if (goal.period === 'yearly') {
                    return projects.filter(p => p.status === 'Archived').length;
                }
                break;
            default:
                return goal.current;
        }
        return goal.current;
    };

    const handleAddGoal = (newGoal: Partial<Goal>) => {
        const goal: Goal = {
            id: `goal-${Date.now()}`,
            title: newGoal.title || 'Nouvel objectif',
            description: newGoal.description,
            type: newGoal.type || 'custom',
            target: newGoal.target || 0,
            current: 0,
            unit: newGoal.unit || '',
            period: newGoal.period || 'yearly',
            year: currentYear,
            month: newGoal.period === 'monthly' ? currentMonth : undefined,
            createdAt: new Date().toISOString()
        };
        setGoals([...goals, goal]);
        setShowAddGoal(false);
    };

    const handleUpdateGoal = (updatedGoal: Goal) => {
        setGoals(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
        setEditingGoal(null);
    };

    const handleDeleteGoal = (goalId: string) => {
        setGoals(goals.filter(g => g.id !== goalId));
    };

    const getProgressColor = (percent: number) => {
        if (percent >= 100) return 'bg-emerald-500';
        if (percent >= 75) return 'bg-blue-500';
        if (percent >= 50) return 'bg-amber-500';
        return 'bg-red-400';
    };

    const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
        switch (trend) {
            case 'up': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
            case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
            default: return <ArrowRight className="w-4 h-4 text-gray-400" />;
        }
    };

    const filteredGoals = goals.filter(g => {
        if (g.period !== selectedPeriod) return false;
        if (g.year !== currentYear) return false;
        if (selectedPeriod === 'monthly' && g.month !== currentMonth) return false;
        return true;
    });

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                            <Target className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Objectifs & KPIs
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                Suivez vos performances et atteignez vos objectifs
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
                    {/* KPIs Grid */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            <BarChart3 className="w-5 h-5 text-violet-500" />
                            Indicateurs clés
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {kpis.map(kpi => (
                                <div 
                                    key={kpi.id}
                                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                            {kpi.name}
                                        </span>
                                        {getTrendIcon(kpi.trend)}
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                        {kpi.unit === currency ? formatCurrency(kpi.value, currency) : kpi.value.toLocaleString('fr-CH')}
                                    </div>
                                    {kpi.previousValue !== undefined && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                            vs {kpi.unit === currency ? formatCurrency(kpi.previousValue, currency) : kpi.previousValue} précédemment
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Period Selector */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                            {(['monthly', 'quarterly', 'yearly'] as const).map(period => (
                                <button
                                    key={period}
                                    onClick={() => setSelectedPeriod(period)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        selectedPeriod === period 
                                            ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm' 
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                >
                                    {period === 'monthly' ? 'Mensuel' : period === 'quarterly' ? 'Trimestriel' : 'Annuel'}
                                </button>
                            ))}
                        </div>

                        {selectedPeriod === 'monthly' && (
                            <select
                                value={currentMonth}
                                onChange={e => setCurrentMonth(Number(e.target.value))}
                                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                {monthNames.map((name, idx) => (
                                    <option key={idx} value={idx + 1}>{name}</option>
                                ))}
                            </select>
                        )}

                        <select
                            value={currentYear}
                            onChange={e => setCurrentYear(Number(e.target.value))}
                            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            {[2024, 2025, 2026, 2027].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => setShowAddGoal(true)}
                            className="ml-auto flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            <Plus className="w-4 h-4" />
                            Nouvel objectif
                        </button>
                    </div>

                    {/* Goals List */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            <Target className="w-5 h-5 text-violet-500" />
                            Objectifs {selectedPeriod === 'monthly' ? `- ${monthNames[currentMonth - 1]}` : ''} {currentYear}
                        </h3>
                        
                        {filteredGoals.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                <Trophy className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                    Aucun objectif pour cette période
                                </p>
                                <button
                                    onClick={() => setShowAddGoal(true)}
                                    className="mt-3 text-violet-600 dark:text-violet-400 hover:underline text-sm"
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                >
                                    Créer un objectif
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredGoals.map(goal => {
                                    const current = getGoalProgress(goal);
                                    const percent = Math.min(100, Math.round((current / goal.target) * 100));
                                    const isComplete = percent >= 100;
                                    
                                    return (
                                        <div 
                                            key={goal.id}
                                            className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-5 transition-all ${isComplete ? 'ring-2 ring-emerald-500/50' : ''}`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    {isComplete ? (
                                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                    ) : (
                                                        <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                                                            <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                            {goal.title}
                                                        </h4>
                                                        {goal.description && (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                                {goal.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setEditingGoal(goal)}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteGoal(goal.id)}
                                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 mb-2">
                                                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                                    <div 
                                                        className={`h-full ${getProgressColor(percent)} transition-all duration-500`}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 min-w-[50px] text-right" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                    {percent}%
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-sm" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                <span className="text-gray-500 dark:text-gray-400">
                                                    {goal.unit === currency ? formatCurrency(current, currency) : `${current.toLocaleString('fr-CH')} ${goal.unit}`}
                                                </span>
                                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                                    Objectif: {goal.unit === currency ? formatCurrency(goal.target, currency) : `${goal.target.toLocaleString('fr-CH')} ${goal.unit}`}
                                                </span>
                                            </div>

                                            {isComplete && (
                                                <div className="mt-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                    <Sparkles className="w-4 h-4" />
                                                    Objectif atteint ! Félicitations 🎉
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Goal Modal */}
            {(showAddGoal || editingGoal) && (
                <GoalFormModal
                    goal={editingGoal}
                    currency={currency}
                    onSave={editingGoal ? handleUpdateGoal : handleAddGoal}
                    onClose={() => { setShowAddGoal(false); setEditingGoal(null); }}
                    selectedPeriod={selectedPeriod}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                />
            )}
        </div>
    );
};

interface GoalFormModalProps {
    goal?: Goal | null;
    currency: string;
    onSave: (goal: any) => void;
    onClose: () => void;
    selectedPeriod: 'monthly' | 'quarterly' | 'yearly';
    currentYear: number;
    currentMonth: number;
}

const GoalFormModal: React.FC<GoalFormModalProps> = ({ goal, currency, onSave, onClose, selectedPeriod, currentYear, currentMonth }) => {
    const [form, setForm] = useState({
        title: goal?.title || '',
        description: goal?.description || '',
        type: goal?.type || 'custom' as Goal['type'],
        target: goal?.target || 0,
        unit: goal?.unit || currency,
        period: goal?.period || selectedPeriod,
        year: goal?.year || currentYear,
        month: goal?.month || currentMonth
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (goal) {
            onSave({ ...goal, ...form });
        } else {
            onSave(form);
        }
    };

    const goalTypes = [
        { value: 'revenue', label: 'Chiffre d\'affaires', icon: DollarSign, defaultUnit: currency },
        { value: 'clients', label: 'Nombre de clients', icon: Users, defaultUnit: 'clients' },
        { value: 'projects', label: 'Projets', icon: BarChart3, defaultUnit: 'projets' },
        { value: 'custom', label: 'Personnalisé', icon: Target, defaultUnit: '' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {goal ? 'Modifier l\'objectif' : 'Nouvel objectif'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                            Type d'objectif
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {goalTypes.map(type => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setForm({ ...form, type: type.value as Goal['type'], unit: type.defaultUnit || form.unit })}
                                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                                        form.type === type.value 
                                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' 
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <type.icon className="w-4 h-4" />
                                    <span className="text-sm" style={{ fontFamily: 'Raleway, sans-serif' }}>{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                            Titre
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="Ex: Atteindre 100'000 CHF de CA"
                            required
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                            Description (optionnel)
                        </label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            rows={2}
                            placeholder="Décrivez votre objectif..."
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                Valeur cible
                            </label>
                            <input
                                type="number"
                                value={form.target}
                                onChange={e => setForm({ ...form, target: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                min={0}
                                required
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                Unité
                            </label>
                            <input
                                type="text"
                                value={form.unit}
                                onChange={e => setForm({ ...form, unit: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="CHF, clients, projets..."
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            {goal ? 'Enregistrer' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GoalsKPIs;
