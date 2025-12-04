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

// New enum for output mode
export enum EditorOutputMode {
  Clean = 'clean',                    // Remove all track changes markup
  WithTrackedChanges = 'tracked'      // Keep track changes markup in output
}

// New interface for editor configuration
export interface EditorConfig {
  outputMode: EditorOutputMode;
  trackChanges: {
    enabled: boolean;
    visible: boolean;
  };
}