/**
 * Text Formatting Toolbar Component
 * Path: src/app/components/editor-toolbar/text-formatting-toolbar/text-formatting-toolbar.component.ts
 * 
 * Handles text formatting: Bold, Italic, Underline, Strikethrough, Subscript, Superscript.
 * Uses expandable group pattern for less-used actions.
 */

import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { animate, style, transition, trigger } from '@angular/animations';
import { CommandExecutorService } from 'src/app/services/command-executor.service';

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

    button.active .mat-icon { color: var(--ed-primary) !important; }

    .expandable-group {
      display: flex;
      align-items: center;
      gap: var(--ed-group-gap, 2px);
      padding-left: 2px;
      margin-left: 2px;
      border-left: 1px solid rgba(0, 0, 0, 0.08);
    }

    .mat-icon {
      transition: transform var(--ed-duration-normal, 200ms) var(--ed-easing-spring);
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

  constructor(private commandExecutor: CommandExecutorService) { }

  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }

  formatBold(): void {
    this.commandExecutor.executeCommand('bold');
    this.commandExecuted.emit();
  }

  formatItalic(): void {
    this.commandExecutor.executeCommand('italic');
    this.commandExecuted.emit();
  }

  formatUnderline(): void {
    this.commandExecutor.executeCommand('underline');
    this.commandExecuted.emit();
  }

  formatStrikethrough(): void {
    this.commandExecutor.executeCommand('strikeThrough');
    this.commandExecuted.emit();
  }

  formatSubscript(): void {
    this.commandExecutor.executeCommand('subscript');
    this.commandExecuted.emit();
  }

  formatSuperscript(): void {
    this.commandExecutor.executeCommand('superscript');
    this.commandExecuted.emit();
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