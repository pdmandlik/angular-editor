import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommandExecutorService } from 'src/app/services/command-executor.service';

/**
 * Alignment Toolbar Component
 * Handles: Left, Center, Right, Justify
 */
@Component({
    selector: 'ed-alignment-toolbar',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
    template: `
    <button
      matTooltip="Align Left"
      mat-icon-button
      (click)="alignLeft()"
      type="button">
      <mat-icon>format_align_left</mat-icon>
    </button>
    <button
      matTooltip="Align Center"
      mat-icon-button
      (click)="alignCenter()"
      type="button">
      <mat-icon>format_align_center</mat-icon>
    </button>
    <button
      matTooltip="Align Right"
      mat-icon-button
      (click)="alignRight()"
      type="button">
      <mat-icon>format_align_right</mat-icon>
    </button>
    <button
      matTooltip="Justify Content"
      mat-icon-button
      (click)="alignJustify()"
      type="button">
      <mat-icon>format_align_justify</mat-icon>
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
export class AlignmentToolbarComponent {
    @Output() commandExecuted = new EventEmitter<void>();

    constructor(private commandExecutor: CommandExecutorService) { }

    alignLeft(): void {
        this.commandExecutor.executeCommand('justifyLeft');
        this.commandExecuted.emit();
    }

    alignCenter(): void {
        this.commandExecutor.executeCommand('justifyCenter');
        this.commandExecuted.emit();
    }

    alignRight(): void {
        this.commandExecutor.executeCommand('justifyRight');
        this.commandExecuted.emit();
    }

    alignJustify(): void {
        this.commandExecutor.executeCommand('justifyFull');
        this.commandExecuted.emit();
    }
}