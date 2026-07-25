/**
 * TodoWidget — compact dashboard strip of open daily todos
 */

import React, { useEffect } from 'react';
import { ListTodo, CheckCircle2 } from 'lucide-react';
import { useTodoStore } from '../stores/useTodoStore';
import { useUIStore } from '../stores/useUIStore';

export const TodoWidget: React.FC = () => {
    const { todos, loadFromStorage, toggleTodo } = useTodoStore();
    const setShowTodoPanel = useUIStore((s) => s.setShowTodoPanel);

    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    const openTodos = todos.filter((t) => !t.done).slice(0, 5);
    const openCount = todos.filter((t) => !t.done).length;

    return (
        <div className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 mb-4 overflow-hidden">
            <button
                type="button"
                onClick={() => setShowTodoPanel(true)}
                className="w-full flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <ListTodo size={14} className="text-slate-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        To-do du jour
                    </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                    {openCount === 0 ? 'Rien en cours' : `${openCount} ouverte${openCount > 1 ? 's' : ''}`}
                </span>
            </button>
            {openTodos.length === 0 ? (
                <button
                    type="button"
                    onClick={() => setShowTodoPanel(true)}
                    className="w-full px-3 py-3 flex items-center gap-2 text-xs text-slate-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-left"
                >
                    <CheckCircle2 size={14} className="text-[#7C9A7E]" />
                    Clique pour ajouter une tâche
                </button>
            ) : (
                <ul>
                    {openTodos.map((todo) => (
                        <li
                            key={todo.id}
                            className="flex items-center gap-2 px-3 py-2 border-t border-slate-50 dark:border-slate-800/60 first:border-t-0"
                        >
                            <input
                                type="checkbox"
                                checked={false}
                                onChange={() => toggleTodo(todo.id)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-[#7C9A7E] focus:ring-[#7C9A7E] shrink-0"
                            />
                            <button
                                type="button"
                                onClick={() => setShowTodoPanel(true)}
                                className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1 text-left"
                            >
                                {todo.text}
                            </button>
                            {todo.category && (
                                <span className="text-[9px] font-medium text-slate-400 shrink-0">{todo.category}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TodoWidget;
