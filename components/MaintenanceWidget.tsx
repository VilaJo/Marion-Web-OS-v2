import React, { useState } from 'react';
import { Calendar, FileText, DollarSign, Bell, Plus, Trash2, Check, AlertTriangle, Clock, Edit2, X } from 'lucide-react';
import { Project, MaintenanceInfo } from '../types';
import { Card } from './Shared';

interface MaintenanceWidgetProps {
    project: Project;
    onUpdateProject: (updatedProject: Project) => void;
}

export const MaintenanceWidget: React.FC<MaintenanceWidgetProps> = ({ project, onUpdateProject }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<MaintenanceInfo>(
        project.maintenance || {
            freeMaintenanceEndDate: '',
            contractSignDate: '',
            billingDates: [],
            hasContract: false
        }
    );
    const [newBillingDate, setNewBillingDate] = useState('');

    // Check for upcoming alerts
    const getAlerts = () => {
        const alerts: Array<{type: 'urgent' | 'warning'; message: string}> = [];
        const today = new Date();
        
        // Check free maintenance end date (1 month before)
        if (editData.freeMaintenanceEndDate) {
            const endDate = new Date(editData.freeMaintenanceEndDate);
            const oneMonthBefore = new Date(endDate);
            oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
            
            if (today >= oneMonthBefore && today <= endDate) {
                const days = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                alerts.push({
                    type: days <= 7 ? 'urgent' : 'warning',
                    message: `Maintenance offerte expire dans ${days}j`
                });
            }
        }
        
        // Check billing dates (1 day before)
        if (editData.billingDates) {
            editData.billingDates.forEach(dateStr => {
                const billingDate = new Date(dateStr);
                const diffDays = Math.ceil((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                if (diffDays >= 0 && diffDays <= 1) {
                    alerts.push({
                        type: 'urgent',
                        message: diffDays === 0 ? 'Facturation aujourd\'hui' : 'Facturation demain'
                    });
                }
            });
        }
        
        return alerts;
    };

    const alerts = getAlerts();

    const handleSave = () => {
        onUpdateProject({
            ...project,
            maintenance: editData
        });
        setIsEditing(false);
    };

    const handleAddBillingDate = () => {
        if (newBillingDate && !editData.billingDates?.includes(newBillingDate)) {
            setEditData({
                ...editData,
                billingDates: [...(editData.billingDates || []), newBillingDate].sort()
            });
            setNewBillingDate('');
        }
    };

    const handleRemoveBillingDate = (dateToRemove: string) => {
        setEditData({
            ...editData,
            billingDates: editData.billingDates?.filter(d => d !== dateToRemove) || []
        });
    };

    const formatDateShort = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getDaysUntil = (dateStr?: string) => {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        const today = new Date();
        const diffTime = target.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    return (
        <Card className="relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-serif flex items-center gap-2">
                    <Clock size={20} className="text-emerald-500" /> Maintenance
                </h3>
                <button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                >
                    {isEditing ? <><Check size={12} /> Enregistrer</> : <><Edit2 size={12} /> Modifier</>}
                </button>
            </div>

            {/* Alerts */}
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
                /* Edit Mode */
                <div className="space-y-3">
                    {/* Maintenance offerte */}
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-orange-500 shrink-0" />
                        <span className="text-xs text-slate-500 w-24 shrink-0">Offerte jusqu'au</span>
                        <input
                            type="date"
                            value={editData.freeMaintenanceEndDate || ''}
                            onChange={(e) => setEditData({ ...editData, freeMaintenanceEndDate: e.target.value })}
                            className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                    </div>

                    {/* Contrat */}
                    <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-500 shrink-0" />
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                            <input
                                type="checkbox"
                                checked={editData.hasContract}
                                onChange={(e) => setEditData({ ...editData, hasContract: e.target.checked })}
                                className="rounded"
                            />
                            Contrat signé
                        </label>
                        {editData.hasContract && (
                            <input
                                type="date"
                                value={editData.contractSignDate || ''}
                                onChange={(e) => setEditData({ ...editData, contractSignDate: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                        )}
                    </div>

                    {/* Dates facturation */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-xs text-slate-500">Dates de facturation</span>
                        </div>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="date"
                                value={newBillingDate}
                                onChange={(e) => setNewBillingDate(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                            <button
                                onClick={handleAddBillingDate}
                                disabled={!newBillingDate}
                                className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-lg text-xs"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        {editData.billingDates && editData.billingDates.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {editData.billingDates.map((date, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full">
                                        {formatDateShort(date)}
                                        <button onClick={() => handleRemoveBillingDate(date)} className="hover:text-red-500">
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* View Mode */
                <div className="space-y-2.5">
                    {/* Maintenance offerte */}
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Calendar size={12} className="text-orange-600" />
                            </div>
                            <span className="text-xs text-slate-500">Offerte</span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {formatDateShort(editData.freeMaintenanceEndDate)}
                            </span>
                            {editData.freeMaintenanceEndDate && (
                                <span className={`block text-[10px] ${
                                    (getDaysUntil(editData.freeMaintenanceEndDate) ?? 0) < 0 
                                        ? 'text-red-500' 
                                        : (getDaysUntil(editData.freeMaintenanceEndDate) ?? 0) <= 30 
                                            ? 'text-amber-500' 
                                            : 'text-emerald-500'
                                }`}>
                                    {(() => {
                                        const days = getDaysUntil(editData.freeMaintenanceEndDate);
                                        if (days === null) return '';
                                        if (days < 0) return 'Expirée';
                                        if (days === 0) return 'Aujourd\'hui';
                                        return `J-${days}`;
                                    })()}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contrat */}
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <FileText size={12} className="text-blue-600" />
                            </div>
                            <span className="text-xs text-slate-500">Contrat</span>
                        </div>
                        <div className="text-right">
                            {editData.hasContract ? (
                                <>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full font-medium">Actif</span>
                                    {editData.contractSignDate && (
                                        <span className="block text-[10px] text-slate-400 mt-0.5">
                                            Signé le {formatDateShort(editData.contractSignDate)}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-slate-400 italic">Non</span>
                            )}
                        </div>
                    </div>

                    {/* Dates facturation */}
                    <div className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <DollarSign size={12} className="text-emerald-600" />
                            </div>
                            <span className="text-xs text-slate-500">Facturations</span>
                        </div>
                        <div className="text-right">
                            {editData.billingDates && editData.billingDates.length > 0 ? (
                                <div className="flex flex-wrap justify-end gap-1">
                                    {editData.billingDates.slice(0, 3).map((date, idx) => {
                                        const days = getDaysUntil(date);
                                        const isUrgent = days !== null && days >= 0 && days <= 1;
                                        return (
                                            <span 
                                                key={idx} 
                                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                    isUrgent 
                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                }`}
                                            >
                                                {formatDateShort(date)}
                                            </span>
                                        );
                                    })}
                                    {editData.billingDates.length > 3 && (
                                        <span className="text-[10px] text-slate-400">+{editData.billingDates.length - 3}</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-xs text-slate-400 italic">Aucune</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
