import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

/**
 * File: src/app/components/dialogs/table-dialog/table-dialog.component.ts
 */

interface TableDialogData {
  maxRows?: number;
  maxCols?: number;
}

@Component({
  selector: 'ed-table-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>Insert Table</h2>

    <mat-dialog-content>
      <p class="dialog-description">Enter the table dimensions:</p>
      
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Rows</mat-label>
          <input 
            matInput 
            type="number" 
            [(ngModel)]="rows" 
            (ngModelChange)="validateInput()"
            min="1" 
            [max]="maxRows"
            required>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Columns</mat-label>
          <input 
            matInput 
            type="number" 
            [(ngModel)]="cols" 
            (ngModelChange)="validateInput()"
            min="1" 
            [max]="maxCols"
            required>
        </mat-form-field>
      </div>

      <p class="size-preview">Table size: {{ rows }} × {{ cols }}</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button 
        mat-raised-button 
        color="primary" 
        (click)="onInsert()"
        [disabled]="!isValid">
        Insert Table
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 300px;
    }

    .dialog-description {
      margin-bottom: 16px;
      color: #666;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .size-preview {
      margin-top: 8px;
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 4px;
      text-align: center;
      font-weight: 500;
      color: #1976d2;
    }
  `]
})
export class TableDialogComponent implements OnInit {
  rows = 3;
  cols = 3;
  maxRows = 20;
  maxCols = 20;
  isValid = true;

  constructor(
    private dialogRef: MatDialogRef<TableDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TableDialogData
  ) {
    if (data) {
      this.maxRows = data.maxRows || 20;
      this.maxCols = data.maxCols || 20;
    }
  }

  ngOnInit(): void {
    this.validateInput();
  }

  validateInput(): void {
    this.rows = Math.max(1, Math.min(this.maxRows, Number(this.rows) || 1));
    this.cols = Math.max(1, Math.min(this.maxCols, Number(this.cols) || 1));
    this.isValid = this.rows >= 1 && this.cols >= 1;
  }

  onInsert(): void {
    if (!this.isValid) return;

    this.dialogRef.close({
      rows: this.rows,
      cols: this.cols
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}