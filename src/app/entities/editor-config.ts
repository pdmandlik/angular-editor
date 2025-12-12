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