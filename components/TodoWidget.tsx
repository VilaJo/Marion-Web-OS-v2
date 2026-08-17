/**
 * TodoWidget — compact dashboard strip of open daily todos
 * Prefills from today's calendar events.
 */

import React, { useEffect, useMemo } from 'react';
import { ListTodo, CheckCircle2 } from 'lucide-react';
import { useTodoStore, TodoCategory, TODO_CATEGORIES } from '../stores/useTodoStore';
import { useUIStore, useProjectStore } from '../stores';
import { TODO_CATEGORY_COLORS } from '../utils/todoCalendarSync';

export const TodoWidget: React.FC = () => {
    const { todos, loadFromStorage, toggleTodo, syncFromCalendar } = useTodoStore();
    const events = useProjectStore((s) => s.events);
    const setShowTodoPanel = useUIStore((s) => s.setShowTodoPanel);

    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    useEffect(() => {
        syncFromCalendar(events);
    }, [events, syncFromCalendar]);

    const openTodos = todos.filter((t) => !t.done);
    const openCount = openTodos.length;

    const byCategory = useMemo(() => {
        const map = new Map<TodoCategory, typeof openTodos>();
        TODO_CATEGORIES.forEach((c) => map.set(c, []));
        openTodos.forEach((t) => {
            const cat = (t.category || 'Perso') as TodoCategory;
            const list = map.get(cat) || [];
            list.push(t);
            map.set(cat, list);
        });
        return TODO_CATEGORIES.map((c) => ({ cat: c, items: map.get(c) || [] })).filter((g) => g.items.length > 0);
    }, [openTodos]);

    return (
        <div className="w-full rounded-2xl mb-4 overflow-hidden fun-sticker fun-sticker-mint dark:border dark:border-slate-700 dark:bg-slate-900/50 dark:shadow-none">
            <button
                type="button"
                onClick={() => setShowTodoPanel(true)}
                className="w-full flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <ListTodo size={14} className="text-[#2AADA0]" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        To-do du jour
                    </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                    {openCount === 0 ? 'Rien en cours' : `${openCount} ouverte${openCount > 1 ? 's' : ''}`}
                </span>
            </button>
            {openCount === 0 ? (
                <button
                    type="button"
                    onClick={() => setShowTodoPanel(true)}
                    className="w-full px-3 py-3 flex items-center gap-2 text-xs text-slate-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-left"
                >
                    <CheckCircle2 size={14} className="text-[#7C9A7E]" />
                    Calendrier vide — clique pour ajouter une tâche
                </button>
            ) : (
                <div className="max-h-64 overflow-y-auto">
                    {byCategory.map(({ cat, items }) => (
                        <div key={cat}>
                            <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
                                <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: TODO_CATEGORY_COLORS[cat].color }}
                                />
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {cat}
                                </span>
                            </div>
                            <ul>
                                {items.slice(0, cat === byCategory[0]?.cat ? 4 : 3).map((todo) => (
                                    <li
                                        key={todo.id}
                                        className="flex items-center gap-2 px-3 py-1.5 border-t border-slate-50 dark:border-slate-800/60"
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
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TodoWidget;
