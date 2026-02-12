/**
 * HTML Sanitization utility
 * Uses DOMPurify to prevent XSS attacks on any user/server-generated HTML.
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS.
 * Allows standard HTML tags and attributes but strips scripts, event handlers, etc.
 */
export const sanitizeHTML = (html: string): string => {
    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ALLOW_UNKNOWN_PROTOCOLS: false,
    });
};

/**
 * Sanitize SVG string. Allows SVG-specific tags in addition to HTML.
 */
export const sanitizeSVG = (svg: string): string => {
    return DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
    });
};
