import { OverlayRef } from "@angular/cdk/overlay";
import { ComponentRef } from "@angular/core";
import { TrackChangeTooltipComponent } from "../components/track-changes/track-change-tooltip/track-change-tooltip.component";

export interface ImageConfig {
  file: File;
  previewUrl: string;
  altText: string;
  width: number | null;
  height: number | null;
  widthUnit: 'px' | '%' | 'auto';
  heightUnit: 'px' | '%' | 'auto';
  lockRatio: boolean;
  originalWidth: number;
  originalHeight: number;
  alignment: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  vspace: number;
  hspace: number;
  border: number;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
}

export interface ImageUploadResponse {
  url: string;
  fileName: string;
  size: number;
}

export interface ImageUploadError {
  message: string;
  code: string;
}

export interface ImageUploadDialogData {
  file: File;
  previewUrl: string;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface TooltipData {
  element: HTMLElement;
  overlayRef: OverlayRef | null;
  componentRef: ComponentRef<TrackChangeTooltipComponent> | null;
  mouseEnterListener: (() => void) | null;
  mouseLeaveListener: (() => void) | null;
}

export interface ChangeRecord {
  id: string;
  type: 'insert' | 'delete';
  userId: string;
  userName: string;
  timestamp: Date;
  content: string;
  spanElement?: HTMLElement;
  isAccepted?: boolean;
  isRejected?: boolean;
}

export interface TrackChangesState {
  isEnabled: boolean;
  isVisible: boolean;
  changes: ChangeRecord[];
  pendingCount: number;
}

// Enum for output mode
export enum EditorOutputMode {
  Clean = 'clean',                    // Remove all track changes markup
  WithTrackedChanges = 'tracked'      // Keep track changes markup in output
}

/**
 * Enter mode constants - Similar to CKEditor's ENTER constants
 * Determines what element is created when Enter/Shift+Enter is pressed
 */
export enum EnterMode {
  /** New <p> paragraphs are created (Recommended - default for Enter) */
  ENTER_P = 1,
  /** Lines are broken with <br> elements (default for Shift+Enter) */
  ENTER_BR = 2,
  /** New <div> blocks are created */
  ENTER_DIV = 3
}

/**
 * Editor configuration interface
 */
export interface EditorConfig {
  outputMode: EditorOutputMode;
  trackChanges: {
    enabled: boolean;
    visible: boolean;
  };
  /**
   * Sets the behavior of the Enter key.
   * - ENTER_P (1): New <p> paragraphs are created (recommended)
   * - ENTER_BR (2): Lines are broken with <br> elements
   * - ENTER_DIV (3): New <div> blocks are created
   * Default: ENTER_P
   */
  enterMode: EnterMode;
  /**
   * Sets the behavior of the Shift+Enter key combination.
   * - ENTER_P (1): New <p> paragraphs are created
   * - ENTER_BR (2): Lines are broken with <br> elements (default)
   * - ENTER_DIV (3): New <div> blocks are created
   * Default: ENTER_BR
   */
  shiftEnterMode: EnterMode;
}

/**
 * Default editor configuration
 */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  outputMode: EditorOutputMode.WithTrackedChanges,
  trackChanges: {
    enabled: false,
    visible: true
  },
  enterMode: EnterMode.ENTER_DIV,
  shiftEnterMode: EnterMode.ENTER_BR
};

export interface TableDialogData {
  maxRows?: number;
  maxCols?: number;
}

export interface TableDialogResult {
  rows: number;
  cols: number;
}

export type TableHeaderType = 'none' | 'row' | 'column' | 'both';

export interface TableProperties {
  width: string;
  widthUnit: 'px' | '%';
  height: string;
  heightUnit: 'px' | '%';
  cellSpacing: number;
  cellPadding: number;
  border: number;
  borderColor: string;
  backgroundColor: string;
  alignment: 'left' | 'center' | 'right' | '';
  caption: string;
  summary: string;
  headers: TableHeaderType;
}

export interface TablePropertiesDialogData {
  table: HTMLTableElement;
}

/** 
 * Table cell position interface
 */
export interface CellPosition {
    row: number;
    col: number;
    cell: HTMLTableCellElement;
    rowSpan: number;
    colSpan: number;
}

/**
 * Table map - 2D array representing table structure accounting for rowspan/colspan
 */
export type TableMap = (HTMLTableCellElement | null)[][];

/** Event types emitted by the service */
export interface EditorKeyboardEvent {
    type: 'typing' | 'navigation' | 'shortcut' | 'command';
    originalEvent: KeyboardEvent;
    handled: boolean;
}

export interface EditorSelectionEvent {
    hasSelection: boolean;
    isCollapsed: boolean;
    range: Range | null;
}

export interface EditorFocusEvent {
    type: 'focus' | 'blur';
    relatedTarget: EventTarget | null;
}

export interface EditorContextMenuEvent {
    position: { x: number; y: number };
    target: HTMLElement;
    shouldShowCustomMenu: boolean;
    menuType: 'trackChanges' | 'table' | null;
}

/** Navigation keys that don't trigger content changes */
export const NAVIGATION_KEYS = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End', 'PageUp', 'PageDown'
];

/** Keys that should be ignored for typing events */
export const MODIFIER_ONLY_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

/**
 * Snapshot structure - mirrors CKEditor's Image class
 * Stores both content and selection state
 */
export interface Snapshot {
    contents: string;
    selectionStart: number | null;
    selectionEnd: number | null;
}

/**
 * Key groups for typing detection (like CKEditor)
 */
export enum KeyGroup {
    PRINTABLE = 0,
    FUNCTIONAL = 1  // Backspace, Delete
}