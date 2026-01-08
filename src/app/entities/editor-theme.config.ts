/**
 * Editor Theme Configuration
 * Path: src/app/entities/editor-theme.config.ts
 * 
 * Defines theme interfaces and preset themes for the editor.
 * Themes control colors, shapes, shadows, animations, and spacing.
 */

export interface EditorColorPalette {
    primary: string;
    primaryLight: string;
    primarySurface: string;
    surface: string;
    onPrimary: string;
    onSurface: string;
    buttonBg: string;
    buttonHover: string;
    buttonActive: string;
    buttonActiveBg: string;
    success: string;
    error: string;
    warning: string;
}

export interface EditorShapeConfig {
    borderRadiusPill: string;
    borderRadiusButton: string;
    borderRadiusContainer: string;
    borderRadiusMenu: string;
}

export interface EditorElevationConfig {
    shadowSoft: string;
    shadowElevated: string;
    shadowFocused: string;
}

export interface EditorMotionConfig {
    durationFast: string;
    durationNormal: string;
    durationSlow: string;
    durationEnter: string;
    easingStandard: string;
    easingEmphasized: string;
    easingDecelerate: string;
    easingAccelerate: string;
    easingSpring: string;
}

export interface EditorSpacingConfig {
    toolbarPadding: string;
    toolbarGap: string;
    groupPadding: string;
    groupGap: string;
    buttonSize: string;
    iconSize: string;
}

export interface EditorTheme {
    name: string;
    displayName: string;
    colors: EditorColorPalette;
    shape: EditorShapeConfig;
    elevation: EditorElevationConfig;
    motion: EditorMotionConfig;
    spacing: EditorSpacingConfig;
}

const DEFAULT_MOTION: EditorMotionConfig = {
    durationFast: '120ms',
    durationNormal: '200ms',
    durationSlow: '320ms',
    durationEnter: '400ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0.38, 0.9)',
    easingEmphasized: 'cubic-bezier(0.4, 0.14, 0.3, 1)',
    easingDecelerate: 'cubic-bezier(0, 0, 0.3, 1)',
    easingAccelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    easingSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
};

const DEFAULT_SPACING: EditorSpacingConfig = {
    toolbarPadding: '12px 16px',
    toolbarGap: '12px',
    groupPadding: '4px',
    groupGap: '2px',
    buttonSize: '36px',
    iconSize: '20px'
};

export const THEME_LAVENDER: EditorTheme = {
    name: 'lavender',
    displayName: 'Lavender',
    colors: {
        primary: '#7c4dff',
        primaryLight: '#b388ff',
        primarySurface: '#ede7f6',
        surface: '#f5f3f7',
        onPrimary: '#ffffff',
        onSurface: '#1f1f1f',
        buttonBg: '#ffffff',
        buttonHover: 'rgba(124, 77, 255, 0.08)',
        buttonActive: 'rgba(124, 77, 255, 0.16)',
        buttonActiveBg: '#d1c4e9',
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800'
    },
    shape: {
        borderRadiusPill: '24px',
        borderRadiusButton: '12px',
        borderRadiusContainer: '16px',
        borderRadiusMenu: '16px'
    },
    elevation: {
        shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
        shadowElevated: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
        shadowFocused: '0 0 0 2px rgba(124, 77, 255, 0.4), 0 0 0 4px rgba(124, 77, 255, 0.15)'
    },
    motion: DEFAULT_MOTION,
    spacing: DEFAULT_SPACING
};

export const THEME_OCEAN: EditorTheme = {
    name: 'ocean',
    displayName: 'Ocean Blue',
    colors: {
        primary: '#0288d1',
        primaryLight: '#4fc3f7',
        primarySurface: '#e1f5fe',
        surface: '#f0f7fa',
        onPrimary: '#ffffff',
        onSurface: '#1a2027',
        buttonBg: '#ffffff',
        buttonHover: 'rgba(2, 136, 209, 0.08)',
        buttonActive: 'rgba(2, 136, 209, 0.16)',
        buttonActiveBg: '#b3e5fc',
        success: '#00897b',
        error: '#e53935',
        warning: '#fb8c00'
    },
    shape: {
        borderRadiusPill: '24px',
        borderRadiusButton: '12px',
        borderRadiusContainer: '16px',
        borderRadiusMenu: '16px'
    },
    elevation: {
        shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
        shadowElevated: '0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)',
        shadowFocused: '0 0 0 2px rgba(2, 136, 209, 0.4), 0 0 0 4px rgba(2, 136, 209, 0.15)'
    },
    motion: DEFAULT_MOTION,
    spacing: DEFAULT_SPACING
};

export const THEME_FOREST: EditorTheme = {
    name: 'forest',
    displayName: 'Forest Green',
    colors: {
        primary: '#2e7d32',
        primaryLight: '#81c784',
        primarySurface: '#e8f5e9',
        surface: '#f1f8f2',
        onPrimary: '#ffffff',
        onSurface: '#1b2e1c',
        buttonBg: '#ffffff',
        buttonHover: 'rgba(46, 125, 50, 0.08)',
        buttonActive: 'rgba(46, 125, 50, 0.16)',
        buttonActiveBg: '#c8e6c9',
        success: '#388e3c',
        error: '#d32f2f',
        warning: '#f57c00'
    },
    shape: {
        borderRadiusPill: '20px',
        borderRadiusButton: '10px',
        borderRadiusContainer: '14px',
        borderRadiusMenu: '14px'
    },
    elevation: {
        shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
        shadowElevated: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
        shadowFocused: '0 0 0 2px rgba(46, 125, 50, 0.4), 0 0 0 4px rgba(46, 125, 50, 0.15)'
    },
    motion: DEFAULT_MOTION,
    spacing: DEFAULT_SPACING
};

export const THEME_SUNSET: EditorTheme = {
    name: 'sunset',
    displayName: 'Sunset Orange',
    colors: {
        primary: '#f4511e',
        primaryLight: '#ff8a65',
        primarySurface: '#fbe9e7',
        surface: '#fdf5f3',
        onPrimary: '#ffffff',
        onSurface: '#2d1f1a',
        buttonBg: '#ffffff',
        buttonHover: 'rgba(244, 81, 30, 0.08)',
        buttonActive: 'rgba(244, 81, 30, 0.16)',
        buttonActiveBg: '#ffccbc',
        success: '#43a047',
        error: '#c62828',
        warning: '#ef6c00'
    },
    shape: {
        borderRadiusPill: '24px',
        borderRadiusButton: '12px',
        borderRadiusContainer: '16px',
        borderRadiusMenu: '16px'
    },
    elevation: {
        shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
        shadowElevated: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
        shadowFocused: '0 0 0 2px rgba(244, 81, 30, 0.4), 0 0 0 4px rgba(244, 81, 30, 0.15)'
    },
    motion: DEFAULT_MOTION,
    spacing: DEFAULT_SPACING
};

export const THEME_MIDNIGHT: EditorTheme = {
    name: 'midnight',
    displayName: 'Midnight Dark',
    colors: {
        primary: '#bb86fc',
        primaryLight: '#e1bee7',
        primarySurface: '#2d2d3a',
        surface: '#1e1e2e',
        onPrimary: '#1e1e2e',
        onSurface: '#e4e4e7',
        buttonBg: '#2d2d3a',
        buttonHover: 'rgba(187, 134, 252, 0.12)',
        buttonActive: 'rgba(187, 134, 252, 0.24)',
        buttonActiveBg: '#3d3d4a',
        success: '#03dac6',
        error: '#cf6679',
        warning: '#ffb74d'
    },
    shape: {
        borderRadiusPill: '24px',
        borderRadiusButton: '12px',
        borderRadiusContainer: '16px',
        borderRadiusMenu: '16px'
    },
    elevation: {
        shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)',
        shadowElevated: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)',
        shadowFocused: '0 0 0 2px rgba(187, 134, 252, 0.4), 0 0 0 4px rgba(187, 134, 252, 0.2)'
    },
    motion: DEFAULT_MOTION,
    spacing: DEFAULT_SPACING
};

export const THEME_ROSE: EditorTheme = {
    name: 'rose',
    displayName: 'Rose Pink',
    colors: {
        primary: '#e91e63',
        primaryLight: '#f48fb1',
        primarySurface: '#fce4ec',
        surface: '#fdf6f8',
        onPrimary: '#ffffff',
        onSurface: '#2d1a20',
        buttonBg: '#ffffff',
        buttonHover: 'rgba(233, 30, 99, 0.08)',
        buttonActive: 'rgba(233, 30, 99, 0.16)',
        buttonActiveBg: '#f8bbd9',
        success: '#4caf50',
        error: '#d32f2f',
        warning: '#ff9800'
    },
    shape: {
        borderRadiusPill: '28px',
        borderRadiusButton: '14px',
        borderRadiusContainer: '18px',
        borderRadiusMenu: '18px'
    },
    elevation: {
        shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        shadowElevated: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.06)',
        shadowFocused: '0 0 0 2px rgba(233, 30, 99, 0.4), 0 0 0 4px rgba(233, 30, 99, 0.15)'
    },
    motion: DEFAULT_MOTION,
    spacing: DEFAULT_SPACING
};

export const PRESET_THEMES: EditorTheme[] = [
    THEME_LAVENDER,
    THEME_OCEAN,
    THEME_FOREST,
    THEME_SUNSET,
    THEME_MIDNIGHT,
    THEME_ROSE
];

export const DEFAULT_THEME = THEME_LAVENDER;