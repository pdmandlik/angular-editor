/**
 * Editor Theme Service
 * Path: src/app/services/editor-theme.service.ts
 * 
 * Manages runtime theme switching via CSS custom properties.
 * Supports preset themes, custom colors, and localStorage persistence.
 */

import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import {
    EditorTheme,
    EditorColorPalette,
    DEFAULT_THEME,
    PRESET_THEMES
} from '../entities/editor-theme.config';

const THEME_STORAGE_KEY = 'editor-theme';
const CUSTOM_COLORS_STORAGE_KEY = 'editor-custom-colors';

@Injectable({ providedIn: 'root' })
export class EditorThemeService {
    private currentTheme$ = new BehaviorSubject<EditorTheme>(DEFAULT_THEME);
    private styleElement: HTMLStyleElement | null = null;

    constructor(@Inject(DOCUMENT) private document: Document) {
        this.initializeTheme();
    }

    getTheme(): Observable<EditorTheme> {
        return this.currentTheme$.asObservable();
    }

    getCurrentTheme(): EditorTheme {
        return this.currentTheme$.value;
    }

    getPresetThemes(): EditorTheme[] {
        return PRESET_THEMES;
    }

    setTheme(themeName: string): void {
        const theme = PRESET_THEMES.find(t => t.name === themeName);
        if (theme) {
            this.applyTheme(theme);
            this.saveThemeToStorage(themeName);
        }
    }

    applyTheme(theme: EditorTheme): void {
        this.currentTheme$.next(theme);
        this.injectThemeStyles(theme);
    }

    updateColors(colors: Partial<EditorColorPalette>): void {
        const currentTheme = this.currentTheme$.value;
        const updatedTheme: EditorTheme = {
            ...currentTheme,
            name: 'custom',
            displayName: 'Custom',
            colors: { ...currentTheme.colors, ...colors }
        };
        this.applyTheme(updatedTheme);
        this.saveCustomColorsToStorage(updatedTheme.colors);
    }

    setPrimaryColor(primaryColor: string): void {
        const colors = this.generateColorPalette(primaryColor);
        const focusShadow = this.generateFocusShadow(primaryColor);

        const currentTheme = this.currentTheme$.value;
        const updatedTheme: EditorTheme = {
            ...currentTheme,
            name: 'custom',
            displayName: 'Custom',
            colors: { ...currentTheme.colors, ...colors },
            elevation: { ...currentTheme.elevation, shadowFocused: focusShadow }
        };
        this.applyTheme(updatedTheme);
        this.saveCustomColorsToStorage(updatedTheme.colors);
    }

    private generateColorPalette(primary: string): Partial<EditorColorPalette> {
        const rgb = this.hexToRgb(primary);
        if (!rgb) return { primary };

        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const lightHsl = { ...hsl, l: Math.min(hsl.l + 25, 85) };
        const primaryLight = this.hslToHex(lightHsl.h, lightHsl.s, lightHsl.l);

        const surfaceHsl = { ...hsl, s: Math.max(hsl.s - 30, 10), l: 96 };
        const primarySurface = this.hslToHex(surfaceHsl.h, surfaceHsl.s, surfaceHsl.l);

        const surfaceBgHsl = { ...hsl, s: Math.max(hsl.s - 40, 5), l: 97 };
        const surface = this.hslToHex(surfaceBgHsl.h, surfaceBgHsl.s, surfaceBgHsl.l);

        const activeBgHsl = { ...hsl, s: Math.min(hsl.s + 10, 50), l: 85 };
        const buttonActiveBg = this.hslToHex(activeBgHsl.h, activeBgHsl.s, activeBgHsl.l);

        return {
            primary,
            primaryLight,
            primarySurface,
            surface,
            buttonActiveBg,
            buttonHover: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`,
            buttonActive: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`
        };
    }

    private generateFocusShadow(primary: string): string {
        const rgb = this.hexToRgb(primary);
        if (!rgb) return '0 0 0 2px rgba(0, 0, 0, 0.2)';
        return `0 0 0 2px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4), 0 0 0 4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
    }

    private injectThemeStyles(theme: EditorTheme): void {
        if (!this.styleElement) {
            this.styleElement = this.document.createElement('style');
            this.styleElement.id = 'editor-theme-styles';
            this.document.head.appendChild(this.styleElement);
        }
        this.styleElement.textContent = this.generateThemeCss(theme);
    }

    private generateThemeCss(theme: EditorTheme): string {
        return `
      :root {
        --ed-primary: ${theme.colors.primary};
        --ed-primary-light: ${theme.colors.primaryLight};
        --ed-primary-surface: ${theme.colors.primarySurface};
        --ed-surface: ${theme.colors.surface};
        --ed-on-primary: ${theme.colors.onPrimary};
        --ed-on-surface: ${theme.colors.onSurface};
        --ed-button-bg: ${theme.colors.buttonBg};
        --ed-button-hover: ${theme.colors.buttonHover};
        --ed-button-active: ${theme.colors.buttonActive};
        --ed-button-active-bg: ${theme.colors.buttonActiveBg};
        --ed-success: ${theme.colors.success};
        --ed-error: ${theme.colors.error};
        --ed-warning: ${theme.colors.warning};
        --ed-radius-pill: ${theme.shape.borderRadiusPill};
        --ed-radius-button: ${theme.shape.borderRadiusButton};
        --ed-radius-container: ${theme.shape.borderRadiusContainer};
        --ed-radius-menu: ${theme.shape.borderRadiusMenu};
        --ed-shadow-soft: ${theme.elevation.shadowSoft};
        --ed-shadow-elevated: ${theme.elevation.shadowElevated};
        --ed-shadow-focused: ${theme.elevation.shadowFocused};
        --ed-duration-fast: ${theme.motion.durationFast};
        --ed-duration-normal: ${theme.motion.durationNormal};
        --ed-duration-slow: ${theme.motion.durationSlow};
        --ed-duration-enter: ${theme.motion.durationEnter};
        --ed-easing-standard: ${theme.motion.easingStandard};
        --ed-easing-emphasized: ${theme.motion.easingEmphasized};
        --ed-easing-decelerate: ${theme.motion.easingDecelerate};
        --ed-easing-accelerate: ${theme.motion.easingAccelerate};
        --ed-easing-spring: ${theme.motion.easingSpring};
        --ed-toolbar-padding: ${theme.spacing.toolbarPadding};
        --ed-toolbar-gap: ${theme.spacing.toolbarGap};
        --ed-group-padding: ${theme.spacing.groupPadding};
        --ed-group-gap: ${theme.spacing.groupGap};
        --ed-button-size: ${theme.spacing.buttonSize};
        --ed-icon-size: ${theme.spacing.iconSize};
      }
    `;
    }

    private initializeTheme(): void {
        const savedThemeName = localStorage.getItem(THEME_STORAGE_KEY);
        const customColors = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);

        if (customColors) {
            try {
                const colors = JSON.parse(customColors);
                const baseTheme = savedThemeName
                    ? PRESET_THEMES.find(t => t.name === savedThemeName) || DEFAULT_THEME
                    : DEFAULT_THEME;
                this.applyTheme({
                    ...baseTheme,
                    name: 'custom',
                    displayName: 'Custom',
                    colors: { ...baseTheme.colors, ...colors }
                });
                return;
            } catch (e) {
                console.warn('Failed to parse custom colors:', e);
            }
        }

        if (savedThemeName) {
            const theme = PRESET_THEMES.find(t => t.name === savedThemeName);
            if (theme) {
                this.applyTheme(theme);
                return;
            }
        }

        this.applyTheme(DEFAULT_THEME);
    }

    private saveThemeToStorage(themeName: string): void {
        localStorage.setItem(THEME_STORAGE_KEY, themeName);
        localStorage.removeItem(CUSTOM_COLORS_STORAGE_KEY);
    }

    private saveCustomColorsToStorage(colors: EditorColorPalette): void {
        localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(colors));
    }

    private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    private hslToHex(h: number, s: number, l: number): string {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
}