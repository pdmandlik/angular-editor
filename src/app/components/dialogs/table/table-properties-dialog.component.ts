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
 * Table properties data structure
 */
export interface TableProperties {
    width: string;
    widthUnit: 'px' | '%';
    height: string;
    heightUnit: 'px' | '%';
    cellSpacing: number;
    cellPadding: number;
    border: number;
    borderColor: string;
    backgroundColor: string;
    alignment: 'left' | 'center' | 'right' | '';
    caption: string;
    summary: string;
}

export interface TablePropertiesDialogData {
    table: HTMLTableElement;
}

/**
 * Table Properties Dialog Component
 * Similar to CKEditor 4's table properties dialog
 */
@Component({
    selector: 'ed-table-properties-dialog',
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
    <h2 mat-dialog-title>Table Properties</h2>
    
    <mat-dialog-content>
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

            <!-- Spacing -->
            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Cell Spacing</mat-label>
                <input matInput type="number" [(ngModel)]="properties.cellSpacing" min="0">
              </mat-form-field>
              <mat-form-field class="half-width">
                <mat-label>Cell Padding</mat-label>
                <input matInput type="number" [(ngModel)]="properties.cellPadding" min="0">
              </mat-form-field>
            </div>

            <!-- Border -->
            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Border Size</mat-label>
                <input matInput type="number" [(ngModel)]="properties.border" min="0">
              </mat-form-field>
              <mat-form-field class="half-width">
                <mat-label>Alignment</mat-label>
                <mat-select [(ngModel)]="properties.alignment">
                  <mat-option value="">None</mat-option>
                  <mat-option value="left">Left</mat-option>
                  <mat-option value="center">Center</mat-option>
                  <mat-option value="right">Right</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        </mat-tab>

        <!-- Advanced Tab -->
        <mat-tab label="Advanced">
          <div class="tab-content">
            <!-- Colors -->
            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Border Color</mat-label>
                <input matInput type="text" [(ngModel)]="properties.borderColor" placeholder="#000000">
              </mat-form-field>
              <div class="color-preview" [style.backgroundColor]="properties.borderColor || 'transparent'">
                <input type="color" [(ngModel)]="properties.borderColor" class="color-input">
              </div>
            </div>

            <div class="form-row">
              <mat-form-field class="half-width">
                <mat-label>Background Color</mat-label>
                <input matInput type="text" [(ngModel)]="properties.backgroundColor" placeholder="transparent">
              </mat-form-field>
              <div class="color-preview" [style.backgroundColor]="properties.backgroundColor || 'transparent'">
                <input type="color" [(ngModel)]="properties.backgroundColor" class="color-input">
              </div>
            </div>

            <!-- Caption & Summary -->
            <mat-form-field class="full-width">
              <mat-label>Caption</mat-label>
              <input matInput type="text" [(ngModel)]="properties.caption">
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Summary</mat-label>
              <textarea matInput [(ngModel)]="properties.summary" rows="3"></textarea>
            </mat-form-field>
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
      min-width: 450px;
      max-height: 400px;
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
  `]
})
export class TablePropertiesDialogComponent implements OnInit {
    properties: TableProperties = {
        width: '',
        widthUnit: 'px',
        height: '',
        heightUnit: 'px',
        cellSpacing: 0,
        cellPadding: 0,
        border: 1,
        borderColor: '',
        backgroundColor: '',
        alignment: '',
        caption: '',
        summary: ''
    };

    private table: HTMLTableElement;

    constructor(
        private dialogRef: MatDialogRef<TablePropertiesDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TablePropertiesDialogData
    ) {
        this.table = data.table;
    }

    ngOnInit(): void {
        this.loadTableProperties();
    }

    private loadTableProperties(): void {
        const style = this.table.style;
        const computed = window.getComputedStyle(this.table);

        // Width
        if (style.width) {
            const match = style.width.match(/^(\d+)(px|%)$/);
            if (match) {
                this.properties.width = match[1];
                this.properties.widthUnit = match[2] as 'px' | '%';
            }
        } else if (this.table.hasAttribute('width')) {
            const width = this.table.getAttribute('width') || '';
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

        // Cell spacing/padding
        this.properties.cellSpacing = parseInt(this.table.getAttribute('cellspacing') || '0', 10);
        this.properties.cellPadding = parseInt(this.table.getAttribute('cellpadding') || '0', 10);

        // Border
        this.properties.border = parseInt(this.table.getAttribute('border') || '0', 10);
        this.properties.borderColor = style.borderColor || '';

        // Background
        this.properties.backgroundColor = style.backgroundColor || '';

        // Alignment
        const align = this.table.getAttribute('align') || style.marginLeft === 'auto' && style.marginRight === 'auto' ? 'center' : '';
        this.properties.alignment = align as 'left' | 'center' | 'right' | '';

        // Caption
        const caption = this.table.querySelector('caption');
        this.properties.caption = caption?.textContent || '';

        // Summary
        this.properties.summary = this.table.getAttribute('summary') || '';
    }

    onSave(): void {
        this.applyTableProperties();
        this.dialogRef.close(this.properties);
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    private applyTableProperties(): void {
        // Width
        if (this.properties.width) {
            this.table.style.width = `${this.properties.width}${this.properties.widthUnit}`;
            this.table.removeAttribute('width');
        } else {
            this.table.style.width = '';
        }

        // Height
        if (this.properties.height) {
            this.table.style.height = `${this.properties.height}${this.properties.heightUnit}`;
        } else {
            this.table.style.height = '';
        }

        // Cell spacing/padding
        this.table.setAttribute('cellspacing', String(this.properties.cellSpacing));
        this.table.setAttribute('cellpadding', String(this.properties.cellPadding));

        // Border
        if (this.properties.border > 0) {
            this.table.setAttribute('border', String(this.properties.border));
            if (this.properties.borderColor) {
                this.table.style.borderColor = this.properties.borderColor;
            }
        } else {
            this.table.removeAttribute('border');
            this.table.style.borderColor = '';
        }

        // Background
        this.table.style.backgroundColor = this.properties.backgroundColor || '';

        // Alignment
        this.table.removeAttribute('align');
        if (this.properties.alignment === 'center') {
            this.table.style.marginLeft = 'auto';
            this.table.style.marginRight = 'auto';
        } else if (this.properties.alignment === 'right') {
            this.table.style.marginLeft = 'auto';
            this.table.style.marginRight = '0';
        } else if (this.properties.alignment === 'left') {
            this.table.style.marginLeft = '0';
            this.table.style.marginRight = 'auto';
        } else {
            this.table.style.marginLeft = '';
            this.table.style.marginRight = '';
        }

        // Caption
        let caption = this.table.querySelector('caption');
        if (this.properties.caption) {
            if (!caption) {
                caption = document.createElement('caption');
                this.table.insertBefore(caption, this.table.firstChild);
            }
            caption.textContent = this.properties.caption;
        } else if (caption) {
            caption.remove();
        }

        // Summary
        if (this.properties.summary) {
            this.table.setAttribute('summary', this.properties.summary);
        } else {
            this.table.removeAttribute('summary');
        }
    }
}