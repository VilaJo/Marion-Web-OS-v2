import React from 'react';
import { MeetingReportTask } from '../../types';

interface ActionTableProps {
    tasks: MeetingReportTask[];
    editable?: boolean;
    selectedTaskIds?: string[];
    onToggleTask?: (taskId: string, checked: boolean) => void;
    onTaskChange?: (taskId: string, patch: Partial<MeetingReportTask>) => void;
}

export const ActionTable: React.FC<ActionTableProps> = ({
    tasks,
    editable = false,
    selectedTaskIds = [],
    onToggleTask,
    onTaskChange,
}) => {
    if (!tasks.length) {
        return <p className="text-sm text-slate-500">Aucune action detectee.</p>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                    <tr>
                        {editable ? <th className="text-left px-3 py-2 w-12">OK</th> : null}
                        <th className="text-left px-3 py-2">Action</th>
                        <th className="text-left px-3 py-2">Owner</th>
                        <th className="text-left px-3 py-2">Deadline</th>
                        <th className="text-left px-3 py-2">Priorite</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map((task, idx) => (
                        <tr key={task.id || `${task.title}-${idx}`} className="border-t border-slate-200 dark:border-slate-700">
                            {editable ? (
                                <td className="px-3 py-2 align-top">
                                    <input
                                        type="checkbox"
                                        checked={selectedTaskIds.includes(task.id || '')}
                                        onChange={(e) => onToggleTask?.(task.id || '', e.target.checked)}
                                    />
                                </td>
                            ) : null}
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-100 align-top">
                                {editable ? (
                                    <input
                                        type="text"
                                        value={task.title}
                                        onChange={(e) => onTaskChange?.(task.id || '', { title: e.target.value })}
                                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                                    />
                                ) : task.title}
                            </td>
                            <td className="px-3 py-2 text-slate-500 align-top">
                                {editable ? (
                                    <input
                                        type="text"
                                        value={task.owner || ''}
                                        onChange={(e) => onTaskChange?.(task.id || '', { owner: e.target.value })}
                                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                                    />
                                ) : (task.owner || '-')}
                            </td>
                            <td className="px-3 py-2 text-slate-500 align-top">
                                {editable ? (
                                    <input
                                        type="date"
                                        value={task.deadline || ''}
                                        onChange={(e) => onTaskChange?.(task.id || '', { deadline: e.target.value || undefined })}
                                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                                    />
                                ) : (task.deadline || '-')}
                            </td>
                            <td className="px-3 py-2 text-slate-500 align-top">
                                {editable ? (
                                    <select
                                        value={task.priority || 'Medium'}
                                        onChange={(e) => onTaskChange?.(task.id || '', { priority: e.target.value as 'Low' | 'Medium' | 'High' })}
                                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                    </select>
                                ) : (task.priority || 'Medium')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

