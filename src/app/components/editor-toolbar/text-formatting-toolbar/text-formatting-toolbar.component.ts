/**
 * Text Formatting Toolbar Component
 * Path: src/app/components/editor-toolbar/text-formatting-toolbar/text-formatting-toolbar.component.ts
 * 
 * Provides text formatting controls: Bold, Italic, Underline, Strikethrough, Subscript, Superscript.
 * Subscript/Superscript are revealed on hover via expandable group pattern.
 * 
 * Selection Handling:
 * Uses mousedown capture pattern to preserve selection across all formatting operations.
 * This is critical for multi-character selections and consecutive format applications.
 */

import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { animate, style, transition, trigger } from '@angular/animations';
import { CommandExecutorService } from 'src/app/services/command-executor.service';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';

@Component({
  selector: 'ed-text-formatting-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  animations: [
    trigger('buttonExpand', [
      transition(':enter', [
        style({ width: 0, opacity: 0, transform: 'scale(0.8)' }),
        animate('180ms cubic-bezier(0, 0, 0.3, 1)',
          style({ width: '*', opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('140ms cubic-bezier(0.4, 0, 1, 1)',
          style({ width: 0, opacity: 0, transform: 'scale(0.8)' }))
      ])
    ]),
    trigger('iconPop', [
      transition('inactive => active', [
        animate('100ms ease-out', style({ transform: 'scale(1.12)' })),
        animate('150ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)' }))
      ])
    ])
  ],
  template: `
    <button
      matTooltip="Bold (Ctrl+B)"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="formatBold()"
      [class.active]="boldActive"
      type="button">
      <mat-icon [@iconPop]="boldActive ? 'active' : 'inactive'">format_bold</mat-icon>
    </button>
    
    <button
      matTooltip="Italic (Ctrl+I)"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="formatItalic()"
      [class.active]="italicActive"
      type="button">
      <mat-icon [@iconPop]="italicActive ? 'active' : 'inactive'">format_italic</mat-icon>
    </button>
    
    <button
      matTooltip="Underline (Ctrl+U)"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="formatUnderline()"
      [class.active]="underlineActive"
      type="button">
      <mat-icon [@iconPop]="underlineActive ? 'active' : 'inactive'">format_underlined</mat-icon>
    </button>

    <div class="expandable-group" 
         (mouseenter)="showExtras = true" 
         (mouseleave)="showExtras = false">
      <button
        matTooltip="Strikethrough"
        mat-icon-button
        (mousedown)="onMouseDown($event)"
        (click)="formatStrikethrough()"
        [class.active]="strikeActive"
        type="button">
        <mat-icon>strikethrough_s</mat-icon>
      </button>
      
      <ng-container *ngIf="showExtras || subActive || superActive">
        <button
          [@buttonExpand]
          matTooltip="Subscript"
          mat-icon-button
          (mousedown)="onMouseDown($event)"
          (click)="formatSubscript()"
          [class.active]="subActive"
          type="button">
          <mat-icon>subscript</mat-icon>
        </button>
        
        <button
          [@buttonExpand]
          matTooltip="Superscript"
          mat-icon-button
          (mousedown)="onMouseDown($event)"
          (click)="formatSuperscript()"
          [class.active]="superActive"
          type="button">
          <mat-icon>superscript</mat-icon>
        </button>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: var(--ed-group-gap, 2px);
    }

    button {
      border-radius: var(--ed-radius-button, 12px) !important;
      color: var(--ed-on-surface, #1a1a1a) !important;
      transition: 
        background-color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        transform var(--ed-duration-normal, 200ms) var(--ed-easing-spring);
    }

    button:hover:not(:disabled) {
      background-color: var(--ed-button-hover) !important;
      color: var(--ed-primary) !important;
      transform: scale(1.05);
    }

    button:active:not(:disabled) {
      transform: scale(0.95);
      transition: transform var(--ed-duration-fast, 120ms) var(--ed-easing-standard);
    }

    button.active {
      background-color: var(--ed-button-active-bg) !important;
      color: var(--ed-primary) !important;
    }

    button.active .mat-icon {
      color: var(--ed-primary) !important;
    }

    .mat-icon {
      color: inherit !important;
      transition: transform var(--ed-duration-normal, 200ms) var(--ed-easing-spring);
    }

    .expandable-group {
      display: flex;
      align-items: center;
      gap: var(--ed-group-gap, 2px);
      padding-left: 2px;
      margin-left: 2px;
      border-left: 1px solid color-mix(in srgb, var(--ed-on-surface, #000) 12%, transparent);
    }
  `]
})
export class TextFormattingToolbarComponent {
  @Output() commandExecuted = new EventEmitter<void>();

  boldActive = false;
  italicActive = false;
  underlineActive = false;
  strikeActive = false;
  subActive = false;
  superActive = false;
  showExtras = false;

  private capturedRange: Range | null = null;

  constructor(
    private commandExecutor: CommandExecutorService,
    private selectionManager: SelectionManagerService
  ) { }

  /**
   * Captures selection on mousedown before focus shifts to the button.
   * Without this, multi-character selections fail for subscript/superscript.
   */
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();

    const selection = window.getSelection();
    const editorElement = this.selectionManager.getEditorElement();

    if (selection && selection.rangeCount > 0 && editorElement) {
      const range = selection.getRangeAt(0);
      if (editorElement.contains(range.commonAncestorContainer)) {
        this.capturedRange = range.cloneRange();
        this.selectionManager.saveSelection();
      }
    }
  }

  formatBold(): void {
    this.executeFormattingCommand('bold');
  }

  formatItalic(): void {
    this.executeFormattingCommand('italic');
  }

  formatUnderline(): void {
    this.executeFormattingCommand('underline');
  }

  formatStrikethrough(): void {
    this.executeFormattingCommand('strikeThrough');
  }

  formatSubscript(): void {
    this.executeFormattingCommand('subscript');
  }

  formatSuperscript(): void {
    this.executeFormattingCommand('superscript');
  }

  /**
   * Executes formatting command with proper selection restoration.
   * Uses setTimeout to ensure selection is applied before execCommand runs.
   */
  private executeFormattingCommand(command: string): void {
    const editorElement = this.selectionManager.getEditorElement();
    if (!editorElement) return;

    editorElement.focus();

    if (this.capturedRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(this.capturedRange);
      }
    } else {
      this.selectionManager.restoreSelection();
    }

    setTimeout(() => {
      try {
        const result = document.execCommand(command, false, '');
        if (result) {
          this.selectionManager.saveSelection();
          this.updateState();
          this.commandExecuted.emit();
        }
      } catch (error) {
        console.error(`${command} command failed:`, error);
      }
      this.capturedRange = null;
    }, 0);
  }

  updateState(): void {
    this.boldActive = this.commandExecutor.getCommandState('bold');
    this.italicActive = this.commandExecutor.getCommandState('italic');
    this.underlineActive = this.commandExecutor.getCommandState('underline');
    this.strikeActive = this.commandExecutor.getCommandState('strikeThrough');
    this.subActive = this.commandExecutor.getCommandState('subscript');
    this.superActive = this.commandExecutor.getCommandState('superscript');
  }
}