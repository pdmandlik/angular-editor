import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommandExecutorService } from 'src/app/services/command-executor.service';

/**
 * List Toolbar Component
 * Handles: Bulleted List, Numbered List
 */
@Component({
    selector: 'ed-list-toolbar',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
    template: `
    <button
      matTooltip="Bullet List"
      mat-icon-button
      (click)="insertUnorderedList()"
      type="button">
      <mat-icon>format_list_bulleted</mat-icon>
    </button>
    <button
      matTooltip="Numbered List"
      mat-icon-button
      (click)="insertOrderedList()"
      type="button">
      <mat-icon>format_list_numbered</mat-icon>
    </button>
  `,
    styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `]
})
export class ListToolbarComponent {
    @Output() commandExecuted = new EventEmitter<void>();

    constructor(private commandExecutor: CommandExecutorService) { }

    insertUnorderedList(): void {
        this.commandExecutor.executeCommand('insertUnorderedList');
        this.commandExecuted.emit();
    }

    insertOrderedList(): void {
        this.commandExecutor.executeCommand('insertOrderedList');
        this.commandExecuted.emit();
    }
}