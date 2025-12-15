import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

interface TableDialogData {
  maxRows: number;
  maxCols: number;
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
  templateUrl: './table-dialog.component.html',
  styleUrls: ['./table-dialog.component.scss']
})
export class TableDialogComponent implements OnInit {
  maxRows = 10;
  maxCols = 10;
  selectedRows = 2;
  selectedCols = 3;

  constructor(
    private dialogRef: MatDialogRef<TableDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TableDialogData
  ) {
    if (data) {
      this.maxRows = data.maxRows || 10;
      this.maxCols = data.maxCols || 10;
    }
  }

  ngOnInit(): void {
    this.validateSelection();
  }

  createGrid(): number[][] {
    const grid = [];
    for (let i = 0; i < this.maxRows; i++) {
      const row = [];
      for (let j = 0; j < this.maxCols; j++) {
        row.push(j);
      }
      grid.push(row);
    }
    return grid;
  }

  onCellHover(rowIndex: number, colIndex: number) {
    this.selectedRows = rowIndex + 1;
    this.selectedCols = colIndex + 1;
  }

  onCellClick() {
    if (this.validateSelection()) {
      this.onSubmit();
    }
  }

  onSubmit() {
    if (!this.validateSelection()) {
      return;
    }
    
    this.dialogRef.close({
      rows: this.selectedRows,
      cols: this.selectedCols
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  isSelected(row: number, col: number): boolean {
    return row < this.selectedRows && col < this.selectedCols;
  }

  private validateSelection(): boolean {
    this.selectedRows = Number(this.selectedRows) || 1;
    this.selectedCols = Number(this.selectedCols) || 1;
    
    this.selectedRows = Math.max(1, Math.min(this.maxRows, this.selectedRows));
    this.selectedCols = Math.max(1, Math.min(this.maxCols, this.selectedCols));
    
    return this.selectedRows >= 1 && this.selectedRows <= this.maxRows &&
           this.selectedCols >= 1 && this.selectedCols <= this.maxCols;
  }

  onRowsChange(): void {
    this.validateSelection();
  }

  onColsChange(): void {
    this.validateSelection();
  }
}