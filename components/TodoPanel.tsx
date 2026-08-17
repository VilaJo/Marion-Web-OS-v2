/**
 * TodoPanel — full daily to-do list (Linear / Eonora style)
 *
 * Extracted from FinancialHealthWidget todo mode: categories, filters,
 * voice input, edit/delete, reminder time. Backed by useTodoStore.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Mic, Pencil, Trash2, Check, X, ListTodo } from 'lucide-react';
import { useTodoStore, TodoCategory, DailyTodo, TODO_CATEGORIES } from '../stores/useTodoStore';
import { useProjectStore } from '../stores';
import { TODO_CATEGORY_COLORS } from '../utils/todoCalendarSync';

interface TodoPanelProps {
    onAddReminder?: (todoId: string, text: string, remindAt: Date) => void;
    onAddCalendarEvent?: (event: {
        title: string;
        date: string;
        startTime: string;
        duration: number;
        addMeet: boolean;
    }) => void;
}

const CATEGORIES: TodoCategory[] = TODO_CATEGORIES;

function formatTimeLabel(remindAt: string): string | null {
    if (!remindAt) return null;
    const [h, m] = remindAt.split(':');
    return `${h}h${m || '00'}`;
}

function parseReminderText(input: string): {
    text: string;
    remindAt: Date;
    isEvent: boolean;
    wantsMeet: boolean;
    duration: number;
    cleanTitle: string;
} {
    const now = new Date();
    const lower = input.toLowerCase();
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let hours = now.getHours() + 1;
    let minutes = 0;
    let duration = 15;
    let isEvent = false;
    let wantsMeet = false;

    if (/demain/i.test(lower)) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (/apr[eè]s[- ]?demain/i.test(lower)) {
        targetDate.setDate(targetDate.getDate() + 2);
    } else {
        const dayNames: Record<string, number> = {
            lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
        };
        for (const [name, dayNum] of Object.entries(dayNames)) {
            if (lower.includes(name)) {
                let diff = dayNum - now.getDay();
                if (diff <= 0) diff += 7;
                targetDate.setDate(targetDate.getDate() + diff);
                break;
            }
        }
    }

    const rangeMatch = lower.match(/(?:de\s+)?(\d{1,2})\s*[hH:]\s*(\d{2})?\s*(?:à|a|-)\s*(\d{1,2})\s*[hH:]\s*(\d{2})?/);
    if (rangeMatch) {
        hours = Math.min(23, Math.max(0, Number(rangeMatch[1])));
        minutes = rangeMatch[2] ? Math.min(59, Number(rangeMatch[2])) : 0;
        const endH = Math.min(23, Math.max(0, Number(rangeMatch[3])));
        const endM = rangeMatch[4] ? Math.min(59, Number(rangeMatch[4])) : 0;
        duration = Math.max(15, endH * 60 + endM - (hours * 60 + minutes));
    } else {
        const timeMatch = lower.match(/(\d{1,2})\s*[hH:]\s*(\d{2})?/);
        if (timeMatch) {
            hours = Math.min(23, Math.max(0, Number(timeMatch[1])));
            if (timeMatch[2]) minutes = Math.min(59, Number(timeMatch[2]));
        }
    }

    if (/\b(rdv|réunion|reunion|meeting|call|visio|rendez[- ]?vous|t[ée]l[ée]phone|appel)\b/i.test(lower)) {
        isEvent = true;
        if (duration <= 15) duration = 60;
    }
    if (/\b(meet|google\s*meet|lien\s*meet)\b/i.test(lower)) {
        wantsMeet = true;
        isEvent = true;
        if (duration <= 15) duration = 60;
    }

    let cleanTitle = '';
    const quotedMatch = input.match(/["'""'']([^"'""'']+)["'""'']/);
    if (quotedMatch) {
        cleanTitle = quotedMatch[1].trim();
    } else {
        cleanTitle = input
            .replace(/^.*?(rappelle[sz]?[- ]?(moi|nous)\s*(que\s*)?(j['']?\s*(ai|aurai[s]?)\s+)?)/i, '')
            .replace(/^.*?(n['']?\s*oublie\s+pas\s+(de|que|d[''])\s*)/i, '')
            .replace(/^.*?(pense\s+[àa]\s*)/i, '')
            .replace(/^.*?((il\s+)?faut\s+(que\s+)?(je|j[''])\s*)/i, '')
            .replace(/^.*?(je\s+(dois|veux|vais|devrai[s]?)\s+)/i, '')
            .replace(/^.*?(mets?|ajoute|cr[ée]+e?r?|met|note|planifie|pr[ée]vois)\s+(moi\s+)?(un\s+|une\s+|le\s+|la\s+|du\s+|des\s+)?/i, '')
            .replace(/\b(dans|sur)\s+(l['']?\s*agenda|le\s+calendrier|mon\s+agenda)\b/gi, '')
            .replace(/\b(demain|aujourd['']?\s*hui|apr[eè]s[- ]?demain|ce\s+(matin|soir|midi)|le\s+\d{1,2}(\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre))?)\b/gi, '')
            .replace(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*(prochain|dernier)?\b/gi, '')
            .replace(/\b(vers|[àa]|pour|avant)\s+\d{1,2}\s*[hH:]\s*\d{0,2}\b/g, '')
            .replace(/(?:de\s+)?\d{1,2}\s*[hH:]\s*\d{0,2}\s*(?:(?:à|a|-)\s*\d{1,2}\s*[hH:]\s*\d{0,2})?/g, '')
            .replace(/\bavec\s+(un\s+)?lien\s+(google\s*)?meet\b/gi, '')
            .replace(/\b(avec\s+meet|lien\s+(google\s*)?meet)\b/gi, '')
            .replace(/\b(rdv|réunion|reunion|meeting|rendez[- ]?vous)\s+(avec|chez|pour)?\s*/gi, (_, _kw, prep) => (prep ? `${prep} ` : ''))
            .replace(/\b(rappel\s+\d+\s*min\s*(avant)?)\b/gi, '')
            .replace(/\bavec\s+(un\s+|le\s+)?titre\b/gi, '')
            .replace(/["'""'']/g, '')
            .replace(/^\s*[-–—,.:;!?\s]+/, '')
            .replace(/[-–—,.:;!?\s]+$/, '')
            .replace(/^\s*(de|du|et|un|une|le|la|les|l['']|des|mon|ma|mes|son|sa|que|qui)\s+/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    if (cleanTitle) {
        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    } else {
        cleanTitle = input.trim();
    }

    targetDate.setHours(hours, minutes, 0, 0);
    return { text: input, remindAt: targetDate, isEvent, wantsMeet, duration, cleanTitle };
}

export const TodoPanel: React.FC<TodoPanelProps> = ({ onAddReminder, onAddCalendarEvent }) => {
    const { todos, addTodo, updateTodo, removeTodo, toggleTodo, loadFromStorage, syncFromCalendar } = useTodoStore();
    const events = useProjectStore((s) => s.events);
    const [newTodo, setNewTodo] = useState('');
    const [newTodoCategory, setNewTodoCategory] = useState<TodoCategory>('Perso');
    const [categoryFilter, setCategoryFilter] = useState<TodoCategory | 'all'>('all');
    const [isListening, setIsListening] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [editingTime, setEditingTime] = useState('');
    const [editingCategory, setEditingCategory] = useState<TodoCategory>('Perso');
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    useEffect(() => {
        syncFromCalendar(events);
    }, [events, syncFromCalendar]);

    useEffect(() => {
        if (!editingId) return;
        const todo = todos.find((t) => t.id === editingId);
        setEditingText(todo?.text ?? '');
        setEditingTime(todo?.remindAt ?? '');
        setEditingCategory(todo?.category ?? 'Perso');
        setTimeout(() => editInputRef.current?.focus(), 50);
    }, [editingId, todos]);

    const saveEdit = (id: string) => {
        const trimmed = editingText.trim();
        if (trimmed) {
            updateTodo(id, {
                text: trimmed,
                remindAt: editingTime || undefined,
                category: editingCategory,
            });
        }
        setEditingId(null);
    };

    const addTodoFromText = (raw: string, category: TodoCategory = 'Perso') => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        const { remindAt, isEvent, wantsMeet, duration, cleanTitle } = parseReminderText(trimmed);
        const remindAtStr = `${String(remindAt.getHours()).padStart(2, '0')}:${String(remindAt.getMinutes()).padStart(2, '0')}`;
        const todoLabel = isEvent ? `📅 ${cleanTitle}` : `🔔 ${cleanTitle}`;
        const id = addTodo({ text: todoLabel, done: false, remindAt: remindAtStr, category });

        if (isEvent && onAddCalendarEvent) {
            const dateStr = `${remindAt.getFullYear()}-${String(remindAt.getMonth() + 1).padStart(2, '0')}-${String(remindAt.getDate()).padStart(2, '0')}`;
            const timeStr = `${String(remindAt.getHours()).padStart(2, '0')}:${String(remindAt.getMinutes()).padStart(2, '0')}`;
            onAddCalendarEvent({ title: cleanTitle, date: dateStr, startTime: timeStr, duration, addMeet: wantsMeet });
        } else if (onAddReminder) {
            onAddReminder(id, cleanTitle, remindAt);
        }
        setNewTodo('');
    };

    const handleVoiceCapture = () => {
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
            addTodoFromText(event.results[0][0].transcript, newTodoCategory);
        };
        recognition.start();
    };

    const filtered = todos.filter((t) => categoryFilter === 'all' || t.category === categoryFilter);

    const categoryBadge = (cat?: TodoCategory) => {
        if (!cat) return 'text-slate-500 bg-slate-100 dark:bg-slate-800';
        return TODO_CATEGORY_COLORS[cat]?.badge || 'text-slate-500 bg-slate-100 dark:bg-slate-800';
    };

    return (
        <div className="flex flex-col gap-4 p-1">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    <ListTodo size={18} />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">To-do du jour</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Le calendrier du jour apparaît ici (Rendez-vous, Client, Deadlines…). Tu complètes au fil de l&apos;eau.
                    </p>
                </div>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1.5">
                {(['all', ...CATEGORIES] as const).map((cat) => {
                    const active = categoryFilter === cat;
                    const label = cat === 'all' ? 'Tous' : cat;
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                active
                                    ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Input row */}
            <div className="flex flex-col gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-2.5">
                <div className="flex items-center gap-2">
                    <input
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTodoFromText(newTodo, newTodoCategory)}
                        placeholder="Rappelle-moi d'envoyer un email avant 14h…"
                        className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 min-w-0"
                    />
                    <button
                        type="button"
                        onClick={() => addTodoFromText(newTodo, newTodoCategory)}
                        className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[#7C9A7E] text-white hover:bg-[#647D66] transition-colors shrink-0"
                    >
                        Ajouter
                    </button>
                    <button
                        type="button"
                        onClick={handleVoiceCapture}
                        className={`p-2 rounded-md border transition-colors shrink-0 ${
                            isListening
                                ? 'border-[#b05070] bg-[#b05070]/10 text-[#b05070]'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#b05070]'
                        }`}
                        title="Dicter un rappel"
                    >
                        <Mic size={16} />
                    </button>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Catégorie</span>
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setNewTodoCategory(cat)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                newTodoCategory === cat
                                    ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[200px] max-h-[50vh] overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center gap-1 text-center px-4">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Aucun rappel</span>
                        <span className="text-xs text-slate-400">Ajoute une tâche ou dicte-la au micro</span>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtered.map((todo: DailyTodo) => (
                            <li
                                key={todo.id}
                                className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={todo.done}
                                    onChange={() => toggleTodo(todo.id)}
                                    className="mt-1 w-4 h-4 rounded border-slate-300 text-[#7C9A7E] focus:ring-[#7C9A7E] shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    {editingId === todo.id ? (
                                        <div className="space-y-2">
                                            <input
                                                ref={editInputRef}
                                                type="text"
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit(todo.id);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                                className="w-full text-sm rounded-md px-2 py-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 outline-none focus:ring-1 focus:ring-[#7C9A7E]"
                                            />
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {CATEGORIES.map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setEditingCategory(cat)}
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                                            editingCategory === cat
                                                                ? 'border-slate-300 bg-slate-100 dark:bg-slate-800'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-500'
                                                        }`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-slate-400" />
                                                <input
                                                    type="time"
                                                    value={editingTime || '12:00'}
                                                    onChange={(e) => setEditingTime(e.target.value)}
                                                    className="text-xs rounded-md px-2 py-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none"
                                                />
                                                <span className="text-[10px] text-slate-400">rappel 30 min avant</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => saveEdit(todo.id)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-[#7C9A7E] text-white"
                                                >
                                                    <Check size={12} /> Enregistrer
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(null)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                                >
                                                    <X size={12} /> Annuler
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className={`text-sm ${
                                                        todo.done
                                                            ? 'line-through text-slate-400'
                                                            : 'text-slate-700 dark:text-slate-100'
                                                    }`}
                                                >
                                                    {todo.text}
                                                </span>
                                                {todo.category && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${categoryBadge(todo.category)}`}>
                                                        {todo.category}
                                                    </span>
                                                )}
                                            </div>
                                            {todo.remindAt && (
                                                <div className="text-[10px] font-medium mt-1 flex items-center gap-1 text-slate-400">
                                                    <Clock size={10} /> Vers {formatTimeLabel(todo.remindAt)} · rappel 30 min avant
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                {editingId !== todo.id && (
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setEditingId(todo.id)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            title="Modifier"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeTodo(todo.id)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-[#b05070] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default TodoPanel;
