import React, { useEffect, useState } from 'react';
import { Calendar, DollarSign, Bell, Check, AlertTriangle, Clock, Edit2, Power } from 'lucide-react';
import { Project, MaintenanceInfo } from '../types';
import { Card } from './Shared';
import { useUIStore, useProjectStore } from '../stores';
import { syncMaintenanceCalendarEvents } from '../utils/maintenanceCalendarSync';

interface MaintenanceWidgetProps {
    project: Project;
    onUpdateProject: (updatedProject: Project) => void;
}

function normalizeMaintenance(raw?: MaintenanceInfo): MaintenanceInfo {
    const base = raw || {
        hasContract: false,
        active: false,
        mode: 'offered' as const,
        billingDates: [],
    };
    let mode = base.mode;
    if (!mode) {
        if (base.freeMaintenanceEndDate) mode = 'offered';
        else if (base.billingDate || (base.billingDates && base.billingDates.length > 0)) mode = 'billing';
        else mode = 'offered';
    }
    return {
        ...base,
        active: base.active ?? base.hasContract ?? false,
        mode,
        billingDate: base.billingDate || base.billingDates?.[0] || '',
    };
}

export const MaintenanceWidget: React.FC<MaintenanceWidgetProps> = ({ project, onUpdateProject }) => {
    const currency = useUIStore((s) => s.currency);
    const events = useProjectStore((s) => s.events);
    const addEvent = useProjectStore((s) => s.addEvent);
    const updateEvent = useProjectStore((s) => s.updateEvent);
    const deleteEvent = useProjectStore((s) => s.deleteEvent);

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<MaintenanceInfo>(() => normalizeMaintenance(project.maintenance));

    useEffect(() => {
        if (!isEditing) {
            setEditData(normalizeMaintenance(project.maintenance));
        }
    }, [project.maintenance, isEditing]);

    const getAlerts = () => {
        const alerts: Array<{ type: 'urgent' | 'warning'; message: string }> = [];
        const today = new Date();
        if (!editData.active) return alerts;

        if (editData.mode === 'offered' && editData.freeMaintenanceEndDate) {
            const endDate = new Date(editData.freeMaintenanceEndDate);
            const oneMonthBefore = new Date(endDate);
            oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
            if (today >= oneMonthBefore && today <= endDate) {
                const days = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                alerts.push({
                    type: days <= 7 ? 'urgent' : 'warning',
                    message: `Offerte expire dans ${days}j`,
                });
            }
        }

        const billing = editData.billingDate || editData.billingDates?.[0];
        if (editData.mode === 'billing' && billing) {
            const billingDate = new Date(billing);
            const diffDays = Math.ceil((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 1) {
                alerts.push({
                    type: 'urgent',
                    message: diffDays === 0 ? 'Facturation aujourd’hui' : 'Facturation demain',
                });
            }
        }
        return alerts;
    };

    const alerts = getAlerts();

    const persist = (next: MaintenanceInfo) => {
        const calendarEventIds = syncMaintenanceCalendarEvents(project, next, events, {
            addEvent,
            updateEvent,
            deleteEvent,
        });
        const payload: MaintenanceInfo = {
            ...next,
            hasContract: next.active ? true : next.hasContract,
            billingDates: next.billingDate ? [next.billingDate] : next.billingDates || [],
            calendarEventIds,
        };
        onUpdateProject({ ...project, maintenance: payload });
        setEditData(payload);
    };

    const handleSave = () => {
        persist(editData);
        setIsEditing(false);
    };

    const toggleActive = () => {
        const next = { ...editData, active: !editData.active };
        setEditData(next);
        if (!isEditing) persist(next);
    };

    const formatDateShort = (dateStr?: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getDaysUntil = (dateStr?: string) => {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        const today = new Date();
        return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    return (
        <Card className="relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-serif flex items-center gap-2">
                    <Clock size={20} className="text-[#4a72c4]" /> Maintenance
                </h3>
                <button
                    onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                    className="text-xs text-[#4a72c4] hover:underline flex items-center gap-1"
                >
                    {isEditing ? (
                        <>
                            <Check size={12} /> Enregistrer
                        </>
                    ) : (
                        <>
                            <Edit2 size={12} /> Modifier
                        </>
                    )}
                </button>
            </div>

            {/* Actif / inactif */}
            <button
                type="button"
                onClick={toggleActive}
                className={`w-full mb-3 flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                    editData.active
                        ? 'border-[#4a72c4]/40 bg-[#4a72c4]/10'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40'
                }`}
            >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <Power size={16} className={editData.active ? 'text-[#4a72c4]' : 'text-slate-400'} />
                    Maintenance {editData.active ? 'active' : 'inactive'}
                </span>
                <span
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                        editData.active ? 'bg-[#4a72c4]' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            editData.active ? 'translate-x-4' : ''
                        }`}
                    />
                </span>
            </button>

            {alerts.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                    {alerts.map((alert, idx) => (
                        <span
                            key={idx}
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                                alert.type === 'urgent'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}
                        >
                            <Bell size={10} />
                            {alert.message}
                        </span>
                    ))}
                </div>
            )}

            {isEditing ? (
                <div className="space-y-3">
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setEditData({ ...editData, mode: 'offered' })}
                            className={`flex-1 px-2 py-2 text-xs font-medium ${
                                editData.mode === 'offered'
                                    ? 'bg-[#4a72c4] text-white'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            Offert jusqu’au
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditData({ ...editData, mode: 'billing' })}
                            className={`flex-1 px-2 py-2 text-xs font-medium ${
                                editData.mode === 'billing'
                                    ? 'bg-[#4a72c4] text-white'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            Facturation le
                        </button>
                    </div>

                    {editData.mode === 'offered' ? (
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-orange-500 shrink-0" />
                            <span className="text-xs text-slate-500 w-28 shrink-0">Offert jusqu’au</span>
                            <input
                                type="date"
                                value={editData.freeMaintenanceEndDate || ''}
                                onChange={(e) =>
                                    setEditData({ ...editData, freeMaintenanceEndDate: e.target.value, mode: 'offered' })
                                }
                                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <DollarSign size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-xs text-slate-500 w-28 shrink-0">Facturation le</span>
                            <input
                                type="date"
                                value={editData.billingDate || ''}
                                onChange={(e) =>
                                    setEditData({
                                        ...editData,
                                        billingDate: e.target.value,
                                        billingDates: e.target.value ? [e.target.value] : [],
                                        mode: 'billing',
                                    })
                                }
                                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-purple-500 shrink-0" />
                        <span className="text-xs text-slate-500 w-28 shrink-0">Coût / mois</span>
                        <div className="flex-1 flex items-center gap-1">
                            <input
                                type="number"
                                min="0"
                                step="10"
                                placeholder="0"
                                value={editData.monthlyPrice ?? ''}
                                onChange={(e) =>
                                    setEditData({
                                        ...editData,
                                        monthlyPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                                    })
                                }
                                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                            />
                            <span className="text-xs text-slate-400 font-medium">{currency}</span>
                        </div>
                    </div>

                    <p className="text-[10px] text-slate-400 flex items-start gap-1">
                        <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                        Si active, la date se calque automatiquement dans le calendrier (catégorie Maintenances).
                    </p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Calendar size={12} className="text-orange-600" />
                            </div>
                            <span className="text-xs text-slate-500">
                                {editData.mode === 'billing' ? 'Facturation' : 'Offert jusqu’au'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {editData.mode === 'billing'
                                    ? formatDateShort(editData.billingDate || editData.billingDates?.[0])
                                    : formatDateShort(editData.freeMaintenanceEndDate)}
                            </span>
                            {editData.mode === 'offered' && editData.freeMaintenanceEndDate && (
                                <span
                                    className={`block text-[10px] ${
                                        (getDaysUntil(editData.freeMaintenanceEndDate) ?? 0) < 0
                                            ? 'text-red-500'
                                            : (getDaysUntil(editData.freeMaintenanceEndDate) ?? 0) <= 30
                                              ? 'text-amber-500'
                                              : 'text-emerald-500'
                                    }`}
                                >
                                    {(() => {
                                        const days = getDaysUntil(editData.freeMaintenanceEndDate);
                                        if (days === null) return '';
                                        if (days < 0) return 'Expirée';
                                        if (days === 0) return 'Aujourd’hui';
                                        return `J-${days}`;
                                    })()}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <DollarSign size={12} className="text-purple-600" />
                            </div>
                            <span className="text-xs text-slate-500">Coût</span>
                        </div>
                        <div className="text-right">
                            {editData.monthlyPrice != null && editData.monthlyPrice > 0 ? (
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {editData.monthlyPrice.toLocaleString('fr-CH')} {currency}
                                    <span className="text-[10px] text-slate-400 font-normal"> /mois</span>
                                </span>
                            ) : (
                                <span className="text-xs text-slate-400 italic">Non défini</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
