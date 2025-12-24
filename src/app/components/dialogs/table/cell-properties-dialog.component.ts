import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';

/**
 * Cell properties data structure
 */
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
    rowSpan: number;
    colSpan: number;
    cellType: 'td' | 'th';
}

export interface CellPropertiesDialogData {
    cells: HTMLTableCellElement[];
}

/**
 * Cell Properties Dialog Component
 * Similar to CKEditor 4's cell properties dialog
 */
@Component({
    selector: 'ed-cell-properties-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTabsModule,
        MatCheckboxModule,
        FormsModule
    ],
    template: `
    <h2 mat-dialog-title>Cell Properties</h2>
    
    <mat-dialog-content>
      <div class="cell-info" *ngIf="data.cells.length > 1">
        <span class="info-badge">{{ data.cells.length }} cells selected</span>
      </div>

      <mat-tab-group>
        <!-- Basic Tab -->
        <mat-tab label="Basic">
          <div class="tab-content">
            <!-- Dimensions -->
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

            <!-- Cell Type -->
            <mat-form-field class="full-width">
              <mat-label>Cell Type</mat-label>
              <mat-select [(ngModel)]="properties.cellType">
                <mat-option value="td">Data Cell</mat-option>
                <mat-option value="th">Header Cell</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Word Wrap -->
            <div class="checkbox-row">
              <mat-checkbox [(ngModel)]="properties.wordWrap">
                Word Wrap
              </mat-checkbox>
            </div>
          </div>
        </mat-tab>

        <!-- Alignment Tab -->
        <mat-tab label="Alignment">
          <div class="tab-content">
            <mat-form-field class="full-width">
              <mat-label>Horizontal Alignment</mat-label>
              <mat-select [(ngModel)]="properties.horizontalAlign">
                <mat-option value="">Default</mat-option>
                <mat-option value="left">Left</mat-option>
                <mat-option value="center">Center</mat-option>
                <mat-option value="right">Right</mat-option>
                <mat-option value="justify">Justify</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Vertical Alignment</mat-label>
              <mat-select [(ngModel)]="properties.verticalAlign">
                <mat-option value="">Default</mat-option>
                <mat-option value="top">Top</mat-option>
                <mat-option value="middle">Middle</mat-option>
                <mat-option value="bottom">Bottom</mat-option>
                <mat-option value="baseline">Baseline</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Alignment Preview -->
            <div class="alignment-preview">
              <div class="preview-cell" 
                   [style.textAlign]="properties.horizontalAlign || 'left'"
                   [style.verticalAlign]="properties.verticalAlign || 'middle'">
                <span>Preview</span>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Advanced Tab -->
        <mat-tab label="Advanced">
          <div class="tab-content">
            <!-- Span -->
            <div class="form-row" *ngIf="data.cells.length === 1">
              <mat-form-field class="half-width">
                <mat-label>Rows Span</mat-label>
                <input matInput type="number" [(ngModel)]="properties.rowSpan" min="1">
              </mat-form-field>
              <mat-form-field class="half-width">
                <mat-label>Columns Span</mat-label>
                <input matInput type="number" [(ngModel)]="properties.colSpan" min="1">
              </mat-form-field>
            </div>

            <!-- Colors -->
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
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()">OK</button>
    </mat-dialog-actions>
  `,
    styles: [`
    mat-dialog-content {
      min-width: 400px;
      max-height: 450px;
    }

    .cell-info {
      margin-bottom: 16px;
    }

    .info-badge {
      background: #e3f2fd;
      color: #1976d2;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
    }

    .tab-content {
      padding: 16px 0;
    }

    .form-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .half-width {
      flex: 1;
    }

    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }

    .unit-select {
      width: 80px;
    }

    .checkbox-row {
      margin: 16px 0;
    }

    .color-preview {
      width: 40px;
      height: 40px;
      border: 1px solid #ccc;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
      margin-top: 4px;
    }

    .color-input {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .alignment-preview {
      margin-top: 16px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .preview-cell {
      width: 100%;
      height: 80px;
      border: 1px dashed #999;
      display: flex;
      align-items: center;
      background: white;
    }

    .preview-cell span {
      width: 100%;
      padding: 8px;
      color: #666;
    }
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
        rowSpan: 1,
        colSpan: 1,
        cellType: 'td'
    };

    constructor(
        private dialogRef: MatDialogRef<CellPropertiesDialogComponent>,
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

        // Cell type
        this.properties.cellType = cell.tagName.toLowerCase() as 'td' | 'th';

        // Width
        if (style.width) {
            const match = style.width.match(/^(\d+)(px|%)$/);
            if (match) {
                this.properties.width = match[1];
                this.properties.widthUnit = match[2] as 'px' | '%';
            }
        } else if (cell.hasAttribute('width')) {
            const width = cell.getAttribute('width') || '';
            this.properties.width = width.replace(/[^\d]/g, '');
            this.properties.widthUnit = width.includes('%') ? '%' : 'px';
        }

        // Height
        if (style.height) {
            const match = style.height.match(/^(\d+)(px|%)$/);
            if (match) {
                this.properties.height = match[1];
                this.properties.heightUnit = match[2] as 'px' | '%';
            }
        }

        // Word wrap
        this.properties.wordWrap = computed.whiteSpace !== 'nowrap';

        // Alignment
        this.properties.horizontalAlign = (style.textAlign || cell.getAttribute('align') || '') as any;
        this.properties.verticalAlign = (style.verticalAlign || cell.getAttribute('valign') || '') as any;

        // Colors
        this.properties.backgroundColor = style.backgroundColor || '';
        this.properties.borderColor = style.borderColor || '';

        // Span
        this.properties.rowSpan = cell.rowSpan || 1;
        this.properties.colSpan = cell.colSpan || 1;
    }

    onSave(): void {
        this.applyCellProperties();
        this.dialogRef.close(this.properties);
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    private applyCellProperties(): void {
        this.data.cells.forEach(cell => {
            // Convert cell type if needed
            if (this.properties.cellType !== cell.tagName.toLowerCase()) {
                const newCell = document.createElement(this.properties.cellType);
                newCell.innerHTML = cell.innerHTML;

                // Copy attributes
                Array.from(cell.attributes).forEach(attr => {
                    newCell.setAttribute(attr.name, attr.value);
                });

                cell.parentNode?.replaceChild(newCell, cell);
                cell = newCell as HTMLTableCellElement;
            }

            // Width
            if (this.properties.width) {
                cell.style.width = `${this.properties.width}${this.properties.widthUnit}`;
                cell.removeAttribute('width');
            } else {
                cell.style.width = '';
            }

            // Height
            if (this.properties.height) {
                cell.style.height = `${this.properties.height}${this.properties.heightUnit}`;
            } else {
                cell.style.height = '';
            }

            // Word wrap
            cell.style.whiteSpace = this.properties.wordWrap ? '' : 'nowrap';

            // Alignment
            cell.style.textAlign = this.properties.horizontalAlign || '';
            cell.style.verticalAlign = this.properties.verticalAlign || '';
            cell.removeAttribute('align');
            cell.removeAttribute('valign');

            // Colors
            cell.style.backgroundColor = this.properties.backgroundColor || '';
            cell.style.borderColor = this.properties.borderColor || '';

            // Span (only for single cell)
            if (this.data.cells.length === 1) {
                if (this.properties.rowSpan > 1) {
                    cell.rowSpan = this.properties.rowSpan;
                } else {
                    cell.removeAttribute('rowspan');
                }

                if (this.properties.colSpan > 1) {
                    cell.colSpan = this.properties.colSpan;
                } else {
                    cell.removeAttribute('colspan');
                }
            }
        });
    }
}