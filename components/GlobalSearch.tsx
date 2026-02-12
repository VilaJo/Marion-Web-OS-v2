/**
 * GlobalSearch - Command palette (Cmd+K) for searching across clients, tasks, invoices, and events.
 *
 * Inspired by VS Code / Linear command palette.
 * Data comes from React Query (projects) and Zustand (events) — no backend call needed.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, CheckSquare, FileText, Calendar, ArrowRight, Command } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useProjects, queryKeys } from '../services/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { Project, Task, Invoice, CalendarEvent } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultCategory = 'client' | 'task' | 'invoice' | 'event';

interface SearchResult {
    id: string;
    category: ResultCategory;
    title: string;
    subtitle: string;
    navigateTo: string;
    icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_PER_CATEGORY = 5;

const categoryLabels: Record<ResultCategory, string> = {
    client: 'Clients',
    task: 'Tâches',
    invoice: 'Factures',
    event: 'Événements',
};

const categoryIcons: Record<ResultCategory, React.ReactNode> = {
    client: <User size={14} />,
    task: <CheckSquare size={14} />,
    invoice: <FileText size={14} />,
    event: <Calendar size={14} />,
};

function matchScore(text: string, query: string): number {
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    if (lower === q) return 3;
    if (lower.startsWith(q)) return 2;
    if (lower.includes(q)) return 1;
    return 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlobalSearch() {
    const navigate = useNavigate();
    const showGlobalSearch = useUIStore((s) => s.showGlobalSearch);
    const setShowGlobalSearch = useUIStore((s) => s.setShowGlobalSearch);

    const events = useProjectStore((s) => s.events);

    // Get projects from React Query cache
    const queryClient = useQueryClient();
    const projects: Project[] = queryClient.getQueryData<Project[]>(queryKeys.projects) ?? [];

    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset when opening
    useEffect(() => {
        if (showGlobalSearch) {
            setQuery('');
            setActiveIndex(0);
            // Use rAF to ensure DOM is ready before focusing
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [showGlobalSearch]);

    // ---------------------------------------------------------------------------
    // Build search results
    // ---------------------------------------------------------------------------

    const results = useMemo<SearchResult[]>(() => {
        const q = query.trim();
        if (!q) return [];

        const all: SearchResult[] = [];

        // --- Clients ---
        const clientResults: (SearchResult & { score: number })[] = [];
        for (const p of projects) {
            const nameScore = matchScore(p.clientName, q);
            const emailScore = matchScore(p.profile?.email ?? '', q);
            const score = Math.max(nameScore, emailScore);
            if (score > 0) {
                clientResults.push({
                    id: `client-${p.id}`,
                    category: 'client',
                    title: p.clientName,
                    subtitle: p.profile?.email || p.status || '',
                    navigateTo: `/client/${p.id}`,
                    icon: categoryIcons.client,
                    score,
                });
            }
        }
        clientResults.sort((a, b) => b.score - a.score);
        all.push(...clientResults.slice(0, MAX_PER_CATEGORY));

        // --- Tasks ---
        const taskResults: (SearchResult & { score: number })[] = [];
        for (const p of projects) {
            for (const t of p.tasks ?? []) {
                const titleScore = matchScore(t.title, q);
                const descScore = matchScore(t.description ?? '', q);
                const score = Math.max(titleScore, descScore);
                if (score > 0) {
                    taskResults.push({
                        id: `task-${p.id}-${t.id}`,
                        category: 'task',
                        title: t.title,
                        subtitle: p.clientName,
                        navigateTo: `/client/${p.id}`,
                        icon: categoryIcons.task,
                        score,
                    });
                }
            }
        }
        taskResults.sort((a, b) => b.score - a.score);
        all.push(...taskResults.slice(0, MAX_PER_CATEGORY));

        // --- Invoices ---
        const invoiceResults: (SearchResult & { score: number })[] = [];
        for (const p of projects) {
            for (const inv of p.invoices ?? []) {
                const numScore = matchScore(inv.number ?? '', q);
                const clientScore = matchScore(inv.clientDisplayName ?? p.clientName, q);
                const score = Math.max(numScore, clientScore);
                if (score > 0) {
                    invoiceResults.push({
                        id: `inv-${p.id}-${inv.id}`,
                        category: 'invoice',
                        title: `${inv.type === 'Estimate' ? 'Devis' : 'Facture'} ${inv.number || inv.id.slice(0, 6)}`,
                        subtitle: `${inv.clientDisplayName || p.clientName} — ${inv.amount != null ? `${inv.amount} ${inv.currency || 'CHF'}` : ''}`,
                        navigateTo: '/finances',
                        icon: categoryIcons.invoice,
                        score,
                    });
                }
            }
        }
        invoiceResults.sort((a, b) => b.score - a.score);
        all.push(...invoiceResults.slice(0, MAX_PER_CATEGORY));

        // --- Events ---
        const eventResults: (SearchResult & { score: number })[] = [];
        for (const ev of events) {
            const titleScore = matchScore(ev.title, q);
            const descScore = matchScore(ev.description ?? '', q);
            const score = Math.max(titleScore, descScore);
            if (score > 0) {
                eventResults.push({
                    id: `ev-${ev.id}`,
                    category: 'event',
                    title: ev.title,
                    subtitle: `${ev.date} · ${ev.startTime}`,
                    navigateTo: '/',
                    icon: categoryIcons.event,
                    score,
                });
            }
        }
        eventResults.sort((a, b) => b.score - a.score);
        all.push(...eventResults.slice(0, MAX_PER_CATEGORY));

        return all;
    }, [query, projects, events]);

    // ---------------------------------------------------------------------------
    // Keyboard navigation
    // ---------------------------------------------------------------------------

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault();
                handleSelect(results[activeIndex]);
            }
        },
        [results, activeIndex],
    );

    // Scroll active item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    // ---------------------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------------------

    const handleSelect = (result: SearchResult) => {
        setShowGlobalSearch(false);
        navigate(result.navigateTo);
    };

    const close = () => setShowGlobalSearch(false);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    if (!showGlobalSearch) return null;

    // Group results by category for display
    const grouped: { category: ResultCategory; items: SearchResult[] }[] = [];
    const seen = new Set<ResultCategory>();
    for (const r of results) {
        if (!seen.has(r.category)) {
            seen.add(r.category);
            grouped.push({ category: r.category, items: results.filter((x) => x.category === r.category) });
        }
    }

    // Flatten index mapping
    let flatIdx = 0;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
            onClick={close}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />

            {/* Palette */}
            <div
                className="relative w-full max-w-xl mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <Search size={18} className="text-slate-400 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Rechercher un client, tâche, facture, événement…"
                        className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-mono">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[50vh] overflow-y-auto overscroll-contain">
                    {query.trim() && results.length === 0 && (
                        <div className="px-5 py-10 text-center text-sm text-slate-400">
                            Aucun résultat pour « {query} »
                        </div>
                    )}

                    {grouped.map((group) => {
                        return (
                            <div key={group.category}>
                                <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    {categoryLabels[group.category]}
                                </div>
                                {group.items.map((item) => {
                                    const idx = flatIdx++;
                                    const isActive = idx === activeIndex;
                                    return (
                                        <button
                                            key={item.id}
                                            data-index={idx}
                                            className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                                                isActive
                                                    ? 'bg-brand-orange/10 text-brand-orange'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                            onClick={() => handleSelect(item)}
                                            onMouseEnter={() => setActiveIndex(idx)}
                                        >
                                            <span className={`flex-shrink-0 ${isActive ? 'text-brand-orange' : 'text-slate-400'}`}>
                                                {item.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold truncate">{item.title}</div>
                                                <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                                            </div>
                                            {isActive && <ArrowRight size={14} className="flex-shrink-0 text-brand-orange" />}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* Footer hint */}
                {!query.trim() && (
                    <div className="px-5 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Command size={12} />
                            <span>Commencez à taper pour chercher…</span>
                        </div>
                        <div className="flex items-center justify-center gap-3 text-[10px]">
                            <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> Naviguer</span>
                            <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">⏎</kbd> Ouvrir</span>
                            <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">Esc</kbd> Fermer</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
