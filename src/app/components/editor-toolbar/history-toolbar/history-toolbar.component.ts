import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';
import { HistoryManagerService } from 'src/app/services/history-manager.service';

/**
 * History Toolbar Component
 * Handles: Undo, Redo, Select All
 * 
 * Now properly integrated with CKEditor-style HistoryManager
 */
@Component({
  selector: 'ed-history-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      matTooltip="Undo (Ctrl+Z)"
      mat-icon-button
      (click)="undoAction()"
      [disabled]="!canUndo"
      type="button">
      <mat-icon>undo</mat-icon>
    </button>
    <button
      matTooltip="Redo (Ctrl+Y)"
      mat-icon-button
      (click)="redoAction()"
      [disabled]="!canRedo"
      type="button">
      <mat-icon>redo</mat-icon>
    </button>
    <button
      matTooltip="Select All"
      mat-icon-button
      (click)="selectAllText()"
      type="button">
      <mat-icon>select_all</mat-icon>
    </button>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    button:disabled {
      opacity: 0.4;
    }
  `]
})
export class HistoryToolbarComponent implements OnInit, OnDestroy {
  @Output() commandExecuted = new EventEmitter<void>();

  canUndo = false;
  canRedo = false;

  private subscription = new Subscription();

  constructor(
    private selectionManager: SelectionManagerService,
    private historyManager: HistoryManagerService
  ) { }

  ngOnInit(): void {
    // Subscribe to history manager state changes
    this.subscription.add(
      this.historyManager.onChange$.subscribe(() => {
        this.updateState();
      })
    );

    // Initial state
    this.updateState();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  undoAction(): void {
    if (this.historyManager.undo()) {
      this.commandExecuted.emit();
      this.updateState();
    }
  }

  redoAction(): void {
    if (this.historyManager.redo()) {
      this.commandExecuted.emit();
      this.updateState();
    }
  }

  selectAllText(): void {
    this.selectionManager.selectAll();
    this.commandExecuted.emit();
  }

  /**
   * Update button states from history manager
   */
  updateState(): void {
    this.canUndo = this.historyManager.canUndo();
    this.canRedo = this.historyManager.canRedo();
  }
}