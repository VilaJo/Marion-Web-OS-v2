/**
 * useKeyboardShortcuts - Global keyboard shortcut handler
 *
 * Extracted from App.tsx for maintainability.
 *
 * Shortcuts:
 *   Cmd/Ctrl+K → Open global search
 *   Escape     → Close active overlay (search, chat, importer)
 *   /          → Focus dashboard search
 *   n          → Open importer
 */

import { useEffect } from 'react';
import { useUIStore } from '../stores';

export function useKeyboardShortcuts() {
    const showChat = useUIStore((s) => s.showChat);
    const setShowChat = useUIStore((s) => s.setShowChat);
    const showImporter = useUIStore((s) => s.showImporter);
    const setShowImporter = useUIStore((s) => s.setShowImporter);
    const isDraggingOver = useUIStore((s) => s.isDraggingOver);
    const setIsDraggingOver = useUIStore((s) => s.setIsDraggingOver);
    const showGlobalSearch = useUIStore((s) => s.showGlobalSearch);
    const setShowGlobalSearch = useUIStore((s) => s.setShowGlobalSearch);

    useEffect(() => {
        const handleShortcuts = (e: KeyboardEvent) => {
            // Cmd+K / Ctrl+K → global search (works even in inputs)
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setShowGlobalSearch(!showGlobalSearch);
                return;
            }

            if (e.key === 'Escape') {
                // Escape always closes the drag overlay first (even when in input)
                if (isDraggingOver) { setIsDraggingOver(false); return; }
                // Close global search first
                if (showGlobalSearch) { setShowGlobalSearch(false); return; }
            }

            // Ignore when typing in form fields
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            if (e.key === 'Escape') {
                if (showChat) setShowChat(false);
                else if (showImporter) setShowImporter(false);
            }

            if (e.key === '/') {
                e.preventDefault();
                document.getElementById('dashboard-search-input')?.focus();
            }

            if (e.key === 'n') {
                e.preventDefault();
                setShowImporter(true);
            }
        };

        window.addEventListener('keydown', handleShortcuts);
        return () => window.removeEventListener('keydown', handleShortcuts);
    }, [showChat, showImporter, isDraggingOver, showGlobalSearch, setShowChat, setShowImporter, setIsDraggingOver, setShowGlobalSearch]);
}
