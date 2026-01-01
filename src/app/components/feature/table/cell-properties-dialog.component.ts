import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';

export interface CellProperties {
  width: string;
  widthUnit: 'px' | '%';
  height: string;
  heightUnit: 'px' | '%';
  wordWrap: boolean;
  horizontalAlign: 'left' | 'center' | 'right' | 'justify' | '';
  verticalAlign: 'top' | 'middle' | 'bottom' | 'baseline' | '';
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  rowSpan: number;
  colSpan: number;
  cellType: 'td' | 'th';
}

export interface CellPropertiesDialogData {
  cells: HTMLTableCellElement[];
}

@Component({
  selector: 'ed-cell-properties-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatCheckboxModule
  ],
  template: `
    <h2 mat-dialog-title>Cell Properties</h2>
    
    <mat-dialog-content>
      <div class="cell-info" *ngIf="data.cells.length > 1">
        <span class="info-badge">{{ data.cells.length }} cells selected</span>
      </div>

      <mat-tab-group>
        <mat-tab label="Basic">
          <div class="tab-content">
            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Width</mat-label>
                <input matInput type="number" [(ngModel)]="properties.width" min="0">
              </mat-form-field>
              <mat-form-field class="unit-select">
                <mat-select [(ngModel)]="properties.widthUnit">
                  <mat-option value="px">px</mat-option>
                  <mat-option value="%">%</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Height</mat-label>
                <input matInput type="number" [(ngModel)]="properties.height" min="0">
              </mat-form-field>
              <mat-form-field class="unit-select">
                <mat-select [(ngModel)]="properties.heightUnit">
                  <mat-option value="px">px</mat-option>
                  <mat-option value="%">%</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Horizontal Align</mat-label>
                <mat-select [(ngModel)]="properties.horizontalAlign">
                  <mat-option value="">None</mat-option>
                  <mat-option value="left">Left</mat-option>
                  <mat-option value="center">Center</mat-option>
                  <mat-option value="right">Right</mat-option>
                  <mat-option value="justify">Justify</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field class="half-width">
                <mat-label>Vertical Align</mat-label>
                <mat-select [(ngModel)]="properties.verticalAlign">
                  <mat-option value="">None</mat-option>
                  <mat-option value="top">Top</mat-option>
                  <mat-option value="middle">Middle</mat-option>
                  <mat-option value="bottom">Bottom</mat-option>
                  <mat-option value="baseline">Baseline</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-checkbox [(ngModel)]="properties.wordWrap" class="checkbox-row">
              Word Wrap
            </mat-checkbox>

            <div class="form-row" *ngIf="data.cells.length === 1">
              <mat-form-field class="half-width">
                <mat-label>Row Span</mat-label>
                <input matInput type="number" [(ngModel)]="properties.rowSpan" min="1">
              </mat-form-field>
              <mat-form-field class="half-width">
                <mat-label>Column Span</mat-label>
                <input matInput type="number" [(ngModel)]="properties.colSpan" min="1">
              </mat-form-field>
            </div>

            <mat-form-field class="full-width">
              <mat-label>Cell Type</mat-label>
              <mat-select [(ngModel)]="properties.cellType">
                <mat-option value="td">Data Cell (td)</mat-option>
                <mat-option value="th">Header Cell (th)</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-tab>

        <mat-tab label="Advanced">
          <div class="tab-content">
            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Background Color</mat-label>
                <input matInput type="text" [(ngModel)]="properties.backgroundColor" placeholder="transparent">
              </mat-form-field>
              <div class="color-preview" [style.backgroundColor]="properties.backgroundColor || '#ffffff'">
                <input type="color" [(ngModel)]="properties.backgroundColor" class="color-input">
              </div>
            </div>

            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Border Color</mat-label>
                <input matInput type="text" [(ngModel)]="properties.borderColor" placeholder="inherit">
              </mat-form-field>
              <div class="color-preview" [style.backgroundColor]="properties.borderColor || '#cccccc'">
                <input type="color" [(ngModel)]="properties.borderColor" class="color-input">
              </div>
            </div>

            <mat-form-field class="half-width">
              <mat-label>Border Width (px)</mat-label>
              <input matInput type="number" [(ngModel)]="properties.borderWidth" min="0" placeholder="1">
            </mat-form-field>

            <div class="preview-section">
              <div class="preview-label">Preview:</div>
              <div class="preview-cell" 
                   [style.textAlign]="properties.horizontalAlign || 'left'"
                   [style.backgroundColor]="properties.backgroundColor || '#ffffff'"
                   [style.border]="(properties.borderWidth || '1') + 'px solid ' + (properties.borderColor || '#ccc')">
                <span>Sample Text</span>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()">OK</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 400px; max-height: 450px; }
    .cell-info { margin-bottom: 16px; }
    .info-badge { background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 16px; font-size: 13px; }
    .tab-content { padding: 16px 0; }
    .form-row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
    .half-width { flex: 1; }
    .full-width { width: 100%; margin-bottom: 8px; }
    .unit-select { width: 80px; }
    .checkbox-row { margin: 16px 0; }
    .color-preview { width: 40px; height: 40px; border: 1px solid #ccc; border-radius: 4px; position: relative; overflow: hidden; margin-top: 4px; }
    .color-input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
    .preview-section { margin-top: 16px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
    .preview-label { font-size: 12px; color: #666; margin-bottom: 8px; }
    .preview-cell { width: 100%; height: 60px; display: flex; align-items: center; background: white; }
    .preview-cell span { width: 100%; padding: 8px; color: #666; }
  `]
})
export class CellPropertiesDialogComponent implements OnInit {
  properties: CellProperties = {
    width: '',
    widthUnit: 'px',
    height: '',
    heightUnit: 'px',
    wordWrap: true,
    horizontalAlign: '',
    verticalAlign: '',
    backgroundColor: '',
    borderColor: '',
    borderWidth: '1',
    rowSpan: 1,
    colSpan: 1,
    cellType: 'td'
  };

  constructor(
    public dialogRef: MatDialogRef<CellPropertiesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CellPropertiesDialogData
  ) { }

  ngOnInit(): void {
    if (this.data.cells.length > 0) {
      this.loadCellProperties(this.data.cells[0]);
    }
  }

  private loadCellProperties(cell: HTMLTableCellElement): void {
    const style = cell.style;
    const computed = window.getComputedStyle(cell);

    this.properties.cellType = cell.tagName.toLowerCase() as 'td' | 'th';

    // Dimensions
    const widthMatch = style.width?.match(/^(\d+)(px|%)$/);
    if (widthMatch) {
      this.properties.width = widthMatch[1];
      this.properties.widthUnit = widthMatch[2] as 'px' | '%';
    }

    const heightMatch = style.height?.match(/^(\d+)(px|%)$/);
    if (heightMatch) {
      this.properties.height = heightMatch[1];
      this.properties.heightUnit = heightMatch[2] as 'px' | '%';
    }

    // Text properties
    this.properties.wordWrap = computed.whiteSpace !== 'nowrap';
    this.properties.horizontalAlign = (style.textAlign || '') as any;
    this.properties.verticalAlign = (style.verticalAlign || '') as any;

    // Colors
    this.properties.backgroundColor = this.rgbToHex(style.backgroundColor);
    this.properties.borderColor = this.rgbToHex(computed.borderTopColor);
    this.properties.borderWidth = parseInt(computed.borderTopWidth, 10).toString() || '1';

    // Span
    this.properties.rowSpan = cell.rowSpan || 1;
    this.properties.colSpan = cell.colSpan || 1;
  }

  private rgbToHex(color: string): string {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return '';
    if (color.startsWith('#')) return color;
    if (!color.startsWith('rgb')) return color;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      return ctx.fillStyle;
    }
    return color;
  }

  onSave(): void {
    this.data.cells.forEach((cell, index) => {
      // Convert cell type if needed
      if (this.properties.cellType !== cell.tagName.toLowerCase()) {
        const newCell = document.createElement(this.properties.cellType) as HTMLTableCellElement;
        newCell.innerHTML = cell.innerHTML;
        Array.from(cell.attributes).forEach(attr => newCell.setAttribute(attr.name, attr.value));
        newCell.style.cssText = cell.style.cssText;
        cell.parentNode?.replaceChild(newCell, cell);
        cell = newCell;
        this.data.cells[index] = newCell;
      }

      // Apply dimensions
      cell.style.width = this.properties.width ? `${this.properties.width}${this.properties.widthUnit}` : '';
      cell.style.height = this.properties.height ? `${this.properties.height}${this.properties.heightUnit}` : '';

      // Apply text properties
      cell.style.whiteSpace = this.properties.wordWrap ? '' : 'nowrap';
      cell.style.textAlign = this.properties.horizontalAlign;
      cell.style.verticalAlign = this.properties.verticalAlign;

      // Apply colors
      cell.style.backgroundColor = this.properties.backgroundColor;

      // Apply border with adjacent cell handling
      if (this.properties.borderColor) {
        this.applyBorderWithNeighbors(cell);
      }

      // Apply span (single cell only)
      if (this.data.cells.length === 1) {
        cell.rowSpan = this.properties.rowSpan > 1 ? this.properties.rowSpan : 1;
        cell.colSpan = this.properties.colSpan > 1 ? this.properties.colSpan : 1;
        if (this.properties.rowSpan <= 1) cell.removeAttribute('rowspan');
        if (this.properties.colSpan <= 1) cell.removeAttribute('colspan');
      }
    });

    this.dialogRef.close(this.properties);
  }

  private applyBorderWithNeighbors(cell: HTMLTableCellElement): void {
    const { borderColor, borderWidth } = this.properties;
    const width = parseInt(borderWidth, 10) || 1;
    const table = cell.closest('table');
    const row = cell.parentElement as HTMLTableRowElement;

    // Apply to target cell
    cell.style.borderWidth = `${width}px`;
    cell.style.borderStyle = 'solid';
    cell.style.borderColor = borderColor;

    if (!table || !row) return;

    const { cellIndex } = cell;
    const { rowIndex } = row;
    const { rows } = table;

    // Update adjacent cells for collapsed border compatibility
    // Cell above
    if (rowIndex > 0) {
      const cellAbove = this.getCellAt(rows[rowIndex - 1], cellIndex);
      if (cellAbove) {
        cellAbove.style.borderBottomWidth = `${width}px`;
        cellAbove.style.borderBottomStyle = 'solid';
        cellAbove.style.borderBottomColor = borderColor;
      }
    }

    // Cell below
    if (rowIndex < rows.length - 1) {
      const cellBelow = this.getCellAt(rows[rowIndex + 1], cellIndex);
      if (cellBelow) {
        cellBelow.style.borderTopWidth = `${width}px`;
        cellBelow.style.borderTopStyle = 'solid';
        cellBelow.style.borderTopColor = borderColor;
      }
    }

    // Cell left
    if (cellIndex > 0 && row.cells[cellIndex - 1]) {
      row.cells[cellIndex - 1].style.borderRightWidth = `${width}px`;
      row.cells[cellIndex - 1].style.borderRightStyle = 'solid';
      row.cells[cellIndex - 1].style.borderRightColor = borderColor;
    }

    // Cell right
    if (cellIndex < row.cells.length - 1 && row.cells[cellIndex + 1]) {
      row.cells[cellIndex + 1].style.borderLeftWidth = `${width}px`;
      row.cells[cellIndex + 1].style.borderLeftStyle = 'solid';
      row.cells[cellIndex + 1].style.borderLeftColor = borderColor;
    }
  }

  private getCellAt(row: HTMLTableRowElement, targetIndex: number): HTMLTableCellElement | null {
    let currentIndex = 0;
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i];
      const colspan = cell.colSpan || 1;
      if (targetIndex >= currentIndex && targetIndex < currentIndex + colspan) {
        return cell;
      }
      currentIndex += colspan;
    }
    return row.cells[targetIndex] || null;
  }
}