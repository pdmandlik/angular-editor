import { Injectable } from '@angular/core';

/**
 * Service for sanitizing editor content
 * Removes potentially dangerous HTML elements and attributes
 */
@Injectable({
    providedIn: 'root'
})
export class ContentSanitizerService {
    /**
     * Sanitize HTML content by removing dangerous elements and attributes
     */
    sanitizeContent(content: string): string {
        return content
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^>]*>/gi, '')
            .replace(/style\s*=\s*["'][^"']*expression\s*\([^"']*\)["']/gi, '')
            .replace(/style\s*=\s*["'][^"']*javascript:[^"']*["']/gi, '')
            .replace(/data-[a-z-]+\s*=\s*["'][^"']*javascript:[^"']*["']/gi, '');
    }

    /**
     * Sanitize image URL
     */
    sanitizeImageUrl(url: string): string | null {
        try {
            if (url.startsWith('data:image/')) {
                return url;
            }

            const urlObj = new URL(url);
            if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
                return url;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}