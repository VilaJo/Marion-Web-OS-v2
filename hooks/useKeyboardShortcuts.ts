/**
 * useKeyboardShortcuts - Global keyboard shortcut handler
 *
 * Extracted from App.tsx for maintainability.
 *
 * Shortcuts:
 *   Escape  → Close active overlay (chat, importer)
 *   /       → Focus dashboard search
 *   n       → Open importer
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

    useEffect(() => {
        const handleShortcuts = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Escape always closes the drag overlay first (even when in input)
                if (isDraggingOver) { setIsDraggingOver(false); return; }
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
    }, [showChat, showImporter, isDraggingOver, setShowChat, setShowImporter, setIsDraggingOver]);
}
