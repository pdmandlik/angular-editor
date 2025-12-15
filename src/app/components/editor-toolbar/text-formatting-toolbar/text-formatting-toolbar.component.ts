import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommandExecutorService } from 'src/app/services/command-executor.service';

/**
 * Text Formatting Toolbar Component
 * Handles: Bold, Italic, Underline, Strikethrough, Subscript, Superscript
 */
@Component({
    selector: 'ed-text-formatting-toolbar',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
    template: `
    <button
      matTooltip="Bold (Ctrl+B)"
      mat-icon-button
      (click)="formatBold()"
      [class.active]="boldActive"
      type="button">
      <mat-icon>format_bold</mat-icon>
    </button>
    <button
      matTooltip="Italic (Ctrl+I)"
      mat-icon-button
      (click)="formatItalic()"
      [class.active]="italicActive"
      type="button">
      <mat-icon>format_italic</mat-icon>
    </button>
    <button
      matTooltip="Underline"
      mat-icon-button
      (click)="formatUnderline()"
      [class.active]="underlineActive"
      type="button">
      <mat-icon>format_underlined</mat-icon>
    </button>
    <button
      matTooltip="Strikethrough"
      mat-icon-button
      (click)="formatStrikethrough()"
      [class.active]="strikeActive"
      type="button">
      <mat-icon>strikethrough_s</mat-icon>
    </button>
    <button
      matTooltip="Subscript"
      mat-icon-button
      (click)="formatSubscript()"
      [class.active]="subActive"
      type="button">
      <mat-icon>subscript</mat-icon>
    </button>
    <button
      matTooltip="Superscript"
      mat-icon-button
      (click)="formatSuperscript()"
      [class.active]="superActive"
      type="button">
      <mat-icon>superscript</mat-icon>
    </button>
  `,
    styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    button.active {
      background-color: rgba(0, 0, 0, 0.1);
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

    constructor(private commandExecutor: CommandExecutorService) { }

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

    /**
     * Update toolbar state based on current selection
     */
    updateState(): void {
        this.boldActive = this.commandExecutor.getCommandState('bold');
        this.italicActive = this.commandExecutor.getCommandState('italic');
        this.underlineActive = this.commandExecutor.getCommandState('underline');
        this.strikeActive = this.commandExecutor.getCommandState('strikeThrough');
        this.subActive = this.commandExecutor.getCommandState('subscript');
        this.superActive = this.commandExecutor.getCommandState('superscript');
    }
}