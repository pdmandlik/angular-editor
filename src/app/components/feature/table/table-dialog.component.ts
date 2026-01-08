/**
 * Table Dialog Component
 * Path: src/app/components/feature/table/table-dialog.component.ts
 * 
 * Modal dialog for inserting tables with visual grid selector.
 * Uses CSS custom properties for theme-aware styling.
 */

import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TableDialogData, TableDialogResult } from 'src/app/entities/editor-config';

@Component({
  selector: 'ed-table-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>Insert Table</h2>

    <mat-dialog-content>
      <p class="description">Select table size:</p>

      <div class="grid-section">
        <div class="grid-container" (mouseleave)="onGridLeave()">
          <div class="grid-row" *ngFor="let r of gridRows; let rowIdx = index">
            <div class="grid-cell"
                 *ngFor="let c of gridCols; let colIdx = index"
                 [class.selected]="isSelected(rowIdx, colIdx)"
                 (mouseenter)="onCellHover(rowIdx, colIdx)"
                 (click)="onCellClick()">
            </div>
          </div>
        </div>
        <div class="size-display">{{ rows }} × {{ cols }}</div>
      </div>

      <div class="manual-section">
        <span class="manual-label">Or enter manually:</span>
        <div class="input-row">
          <mat-form-field appearance="outline" class="compact-field">
            <mat-label>Rows</mat-label>
            <input matInput type="number" [(ngModel)]="rows" min="1" [max]="maxRows" (ngModelChange)="clampValues()">
          </mat-form-field>
          <span class="separator">×</span>
          <mat-form-field appearance="outline" class="compact-field">
            <mat-label>Cols</mat-label>
            <input matInput type="number" [(ngModel)]="cols" min="1" [max]="maxCols" (ngModelChange)="clampValues()">
          </mat-form-field>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button class="primary-btn" (click)="onInsert()" [disabled]="!isValid">
        Insert Table
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 320px;
    }

    .description {
      margin: 0 0 16px;
      color: var(--ed-on-surface, #666);
      opacity: 0.8;
      font-size: 14px;
    }

    .grid-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 20px;
    }

    .grid-container {
      display: inline-block;
      padding: 4px;
      background: var(--ed-surface, #f5f5f5);
      border-radius: 4px;
    }

    .grid-row {
      display: flex;
    }

    .grid-cell {
      width: 24px;
      height: 24px;
      margin: 2px;
      background: var(--ed-button-bg, #ffffff);
      border: 1px solid color-mix(in srgb, var(--ed-on-surface, #000) 15%, transparent);
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.1s ease;
    }

    .grid-cell:hover {
      border-color: var(--ed-primary, #1976d2);
    }

    .grid-cell.selected {
      background: var(--ed-primary, #1976d2);
      border-color: var(--ed-primary, #1976d2);
    }

    .size-display {
      margin-top: 12px;
      padding: 6px 16px;
      background: var(--ed-primary-surface, #e3f2fd);
      color: var(--ed-primary, #1976d2);
      border-radius: 16px;
      font-weight: 500;
      font-size: 14px;
    }

    .manual-section {
      border-top: 1px solid color-mix(in srgb, var(--ed-on-surface, #000) 12%, transparent);
      padding-top: 16px;
    }

    .manual-label {
      display: block;
      color: var(--ed-on-surface, #666);
      opacity: 0.8;
      font-size: 13px;
      margin-bottom: 12px;
    }

    .input-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .compact-field {
      width: 80px;
    }

    .compact-field ::ng-deep .mat-form-field-infix {
      padding: 8px 0 !important;
    }

    .separator {
      color: var(--ed-on-surface, #666);
      opacity: 0.6;
      font-size: 16px;
    }

    .primary-btn {
      background-color: var(--ed-primary, #1976d2) !important;
      color: var(--ed-on-primary, #ffffff) !important;
    }

    .primary-btn:hover:not(:disabled) {
      background-color: color-mix(in srgb, var(--ed-primary, #1976d2) 85%, #000) !important;
    }

    .primary-btn:disabled {
      opacity: 0.5;
    }
  `]
})
export class TableDialogComponent {
  rows = 3;
  cols = 3;
  maxRows: number;
  maxCols: number;

  readonly gridRows = Array(10).fill(0);
  readonly gridCols = Array(10).fill(0);

  constructor(
    public dialogRef: MatDialogRef<TableDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TableDialogData
  ) {
    this.maxRows = data?.maxRows || 20;
    this.maxCols = data?.maxCols || 20;
  }

  get isValid(): boolean {
    return this.rows >= 1 && this.cols >= 1;
  }

  isSelected(rowIdx: number, colIdx: number): boolean {
    return rowIdx < this.rows && colIdx < this.cols;
  }

  onCellHover(rowIdx: number, colIdx: number): void {
    this.rows = rowIdx + 1;
    this.cols = colIdx + 1;
  }

  onGridLeave(): void { }

  onCellClick(): void {
    if (this.isValid) {
      this.dialogRef.close({ rows: this.rows, cols: this.cols } as TableDialogResult);
    }
  }

  clampValues(): void {
    this.rows = Math.max(1, Math.min(this.maxRows, Number(this.rows) || 1));
    this.cols = Math.max(1, Math.min(this.maxCols, Number(this.cols) || 1));
  }

  onInsert(): void {
    if (this.isValid) {
      this.dialogRef.close({ rows: this.rows, cols: this.cols } as TableDialogResult);
    }
  }
}