/**
 * useBreakpoint - Responsive breakpoint detection hook
 * 
 * Uses window.matchMedia for performance (no resize listener spam).
 * Matches Tailwind default breakpoints: sm=640, md=768, lg=1024, xl=1280
 */

import { useState, useEffect } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const QUERIES: Record<string, string> = {
    sm: '(min-width: 640px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 1024px)',
    xl: '(min-width: 1280px)',
};

function getBreakpoint(matches: Record<string, boolean>): Breakpoint {
    if (matches.xl) return 'xl';
    if (matches.lg) return 'lg';
    if (matches.md) return 'md';
    if (matches.sm) return 'sm';
    return 'xs';
}

export function useBreakpoint() {
    const [state, setState] = useState<{
        breakpoint: Breakpoint;
        isMobile: boolean;
        isTablet: boolean;
        isDesktop: boolean;
    }>(() => {
        if (typeof window === 'undefined') {
            return { breakpoint: 'lg', isMobile: false, isTablet: false, isDesktop: true };
        }
        const matches: Record<string, boolean> = {};
        for (const [key, query] of Object.entries(QUERIES)) {
            matches[key] = window.matchMedia(query).matches;
        }
        const bp = getBreakpoint(matches);
        return {
            breakpoint: bp,
            isMobile: !matches.md,     // < 768px
            isTablet: matches.md && !matches.lg, // 768-1023
            isDesktop: matches.lg,      // >= 1024
        };
    });

    useEffect(() => {
        const mediaQueries: Record<string, MediaQueryList> = {};
        const matches: Record<string, boolean> = {};

        for (const [key, query] of Object.entries(QUERIES)) {
            mediaQueries[key] = window.matchMedia(query);
            matches[key] = mediaQueries[key].matches;
        }

        const update = () => {
            for (const [key] of Object.entries(QUERIES)) {
                matches[key] = mediaQueries[key].matches;
            }
            const bp = getBreakpoint(matches);
            setState({
                breakpoint: bp,
                isMobile: !matches.md,
                isTablet: matches.md && !matches.lg,
                isDesktop: matches.lg,
            });
        };

        for (const mq of Object.values(mediaQueries)) {
            mq.addEventListener('change', update);
        }

        return () => {
            for (const mq of Object.values(mediaQueries)) {
                mq.removeEventListener('change', update);
            }
        };
    }, []);

    return state;
}

export default useBreakpoint;
