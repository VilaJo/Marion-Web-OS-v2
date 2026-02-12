/**
 * Tests for utils/sanitize.ts (DOMPurify wrappers)
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHTML, sanitizeSVG } from '../../utils/sanitize';

describe('sanitizeHTML', () => {
    it('allows safe HTML tags', () => {
        const input = '<p>Hello <strong>world</strong></p>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    it('strips script tags', () => {
        const input = '<p>Hello</p><script>alert("xss")</script>';
        expect(sanitizeHTML(input)).toBe('<p>Hello</p>');
    });

    it('strips event handlers', () => {
        const input = '<img src="x" onerror="alert(1)" />';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('onerror');
    });

    it('strips javascript: URLs', () => {
        const input = '<a href="javascript:alert(1)">click</a>';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('javascript:');
    });

    it('allows normal links', () => {
        const input = '<a href="https://example.com">link</a>';
        expect(sanitizeHTML(input)).toBe(input);
    });

    it('handles empty string', () => {
        expect(sanitizeHTML('')).toBe('');
    });

    it('preserves class and style attributes', () => {
        const input = '<span class="text-bold" style="color: red;">styled</span>';
        const result = sanitizeHTML(input);
        expect(result).toContain('class="text-bold"');
    });
});

describe('sanitizeSVG', () => {
    it('allows basic SVG', () => {
        const input = '<svg><circle cx="10" cy="10" r="5" /></svg>';
        const result = sanitizeSVG(input);
        expect(result).toContain('<svg>');
        expect(result).toContain('<circle');
    });

    it('strips script inside SVG', () => {
        const input = '<svg><script>alert(1)</script><circle cx="10" cy="10" r="5" /></svg>';
        const result = sanitizeSVG(input);
        expect(result).not.toContain('<script>');
    });

    it('handles empty string', () => {
        expect(sanitizeSVG('')).toBe('');
    });
});
