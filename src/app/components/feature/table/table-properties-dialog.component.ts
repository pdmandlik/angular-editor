import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { TableProperties, TablePropertiesDialogData } from 'src/app/entities/editor-config';

@Component({
  selector: 'ed-table-properties-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule
  ],
  template: `
    <h2 mat-dialog-title>Table Properties</h2>
    
    <mat-dialog-content>
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
              <mat-form-field class="full-width">
                <mat-label>Headers</mat-label>
                <mat-select [(ngModel)]="properties.headers">
                  <mat-option value="none">None</mat-option>
                  <mat-option value="row">First Row</mat-option>
                  <mat-option value="column">First Column</mat-option>
                  <mat-option value="both">Both</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

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

            <mat-form-field class="full-width">
              <mat-label>Caption</mat-label>
              <input matInput [(ngModel)]="properties.caption">
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Summary</mat-label>
              <textarea matInput [(ngModel)]="properties.summary" rows="2"></textarea>
            </mat-form-field>
          </div>
        </mat-tab>

        <mat-tab label="Advanced">
          <div class="tab-content">
            <div class="form-row">
              <div class="color-field">
                <mat-label>Border Color</mat-label>
                <div class="color-preview" [style.backgroundColor]="properties.borderColor || '#ffffff'">
                  <input type="color" class="color-input" [(ngModel)]="properties.borderColor">
                </div>
              </div>
              <div class="color-field">
                <mat-label>Background Color</mat-label>
                <div class="color-preview" [style.backgroundColor]="properties.backgroundColor || '#ffffff'">
                  <input type="color" class="color-input" [(ngModel)]="properties.backgroundColor">
                </div>
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
    mat-dialog-content { min-width: 450px; max-height: 400px; }
    .tab-content { padding: 16px 0; }
    .form-row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
    .half-width { flex: 1; }
    .full-width { width: 100%; margin-bottom: 8px; }
    .unit-select { width: 80px; }
    .color-field { flex: 1; }
    .color-field mat-label { display: block; font-size: 12px; color: rgba(0,0,0,0.6); margin-bottom: 4px; }
    .color-preview { width: 40px; height: 40px; border: 1px solid #ccc; border-radius: 4px; position: relative; overflow: hidden; }
    .color-input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
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
    summary: '',
    headers: 'none'
  };

  private table: HTMLTableElement;
  private hasRowHeaders = false;
  private hasColumnHeaders = false;

  constructor(
    public dialogRef: MatDialogRef<TablePropertiesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: TablePropertiesDialogData
  ) {
    this.table = data.table;
  }

  ngOnInit(): void {
    this.loadTableProperties();
  }

  private loadTableProperties(): void {
    const { style } = this.table;

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

    // Spacing
    this.properties.cellSpacing = parseInt(this.table.getAttribute('cellspacing') || '0', 10);
    this.properties.cellPadding = parseInt(this.table.getAttribute('cellpadding') || '0', 10);

    // Border
    this.properties.border = parseInt(this.table.getAttribute('border') || '0', 10);
    this.properties.borderColor = this.rgbToHex(style.borderColor);

    // Background
    this.properties.backgroundColor = this.rgbToHex(style.backgroundColor);

    // Alignment
    if (style.marginLeft === 'auto' && style.marginRight === 'auto') {
      this.properties.alignment = 'center';
    } else if (style.marginLeft === 'auto') {
      this.properties.alignment = 'right';
    } else if (style.marginRight === 'auto') {
      this.properties.alignment = 'left';
    }

    // Caption & Summary
    this.properties.caption = this.table.querySelector('caption')?.textContent || '';
    this.properties.summary = this.table.getAttribute('summary') || '';

    // Detect Headers
    this.detectHeaders();
  }

  private detectHeaders(): void {
    // Check for row headers (thead or first row with th elements)
    const thead = this.table.tHead;
    const firstRow = this.table.rows[0];

    this.hasRowHeaders = false;
    this.hasColumnHeaders = false;

    // Check if thead exists or first row contains all th elements
    if (thead && thead.rows.length > 0) {
      this.hasRowHeaders = true;
    } else if (firstRow) {
      const cells = Array.from(firstRow.cells);
      this.hasRowHeaders = cells.length > 0 && cells.every(c => c.tagName === 'TH');
    }

    // Check for column headers (first cell of each row is th with scope="row")
    const rows = Array.from(this.table.rows);
    if (rows.length > 0) {
      const startIdx = this.hasRowHeaders ? 1 : 0;
      const bodyRows = rows.slice(startIdx);

      if (bodyRows.length > 0) {
        this.hasColumnHeaders = bodyRows.every(row => {
          const firstCell = row.cells[0];
          return firstCell && firstCell.tagName === 'TH';
        });
      }
    }

    // Determine header type
    if (this.hasRowHeaders && this.hasColumnHeaders) {
      this.properties.headers = 'both';
    } else if (this.hasRowHeaders) {
      this.properties.headers = 'row';
    } else if (this.hasColumnHeaders) {
      this.properties.headers = 'column';
    } else {
      this.properties.headers = 'none';
    }
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
    // Dimensions
    this.table.style.width = this.properties.width ?
      `${this.properties.width}${this.properties.widthUnit}` : '';
    this.table.style.height = this.properties.height ?
      `${this.properties.height}${this.properties.heightUnit}` : '';

    // Spacing
    this.table.setAttribute('cellspacing', String(this.properties.cellSpacing));
    this.table.setAttribute('cellpadding', String(this.properties.cellPadding));

    // Border
    this.applyTableBorder();

    // Background
    this.table.style.backgroundColor = this.properties.backgroundColor;

    // Alignment
    this.table.removeAttribute('align');
    switch (this.properties.alignment) {
      case 'center':
        this.table.style.marginLeft = 'auto';
        this.table.style.marginRight = 'auto';
        break;
      case 'right':
        this.table.style.marginLeft = 'auto';
        this.table.style.marginRight = '0';
        break;
      case 'left':
        this.table.style.marginLeft = '0';
        this.table.style.marginRight = 'auto';
        break;
      default:
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
    } else {
      caption?.remove();
    }

    // Summary
    if (this.properties.summary) {
      this.table.setAttribute('summary', this.properties.summary);
    } else {
      this.table.removeAttribute('summary');
    }

    // Apply Headers
    this.applyHeaders();

    this.dialogRef.close(this.properties);
  }

  private applyHeaders(): void {
    const headers = this.properties.headers;
    const needsRowHeader = headers === 'row' || headers === 'both';
    const needsColumnHeader = headers === 'column' || headers === 'both';

    // Handle Row Headers (thead)
    this.applyRowHeaders(needsRowHeader);

    // Handle Column Headers (first cell of each row)
    this.applyColumnHeaders(needsColumnHeader);
  }

  private applyRowHeaders(enable: boolean): void {
    let thead = this.table.tHead;
    let tbody = this.table.tBodies[0];

    if (enable) {
      // Need to create/ensure thead with th cells
      if (!thead) {
        thead = this.table.createTHead();
      }

      // If thead is empty, move first row from tbody to thead
      if (thead.rows.length === 0 && tbody && tbody.rows.length > 0) {
        const firstRow = tbody.rows[0];
        thead.appendChild(firstRow);
      }

      // Convert all cells in thead to th with scope="col"
      if (thead.rows.length > 0) {
        const headerRow = thead.rows[0];
        Array.from(headerRow.cells).forEach(cell => {
          if (cell.tagName !== 'TH') {
            const th = this.convertToTh(cell);
            th.setAttribute('scope', 'col');
          } else {
            cell.setAttribute('scope', 'col');
          }
        });
      }
    } else {
      // Remove row headers - move thead content back to tbody
      if (thead && thead.rows.length > 0) {
        if (!tbody) {
          tbody = this.table.createTBody();
        }

        // Move rows from thead to beginning of tbody
        while (thead.rows.length > 0) {
          const row = thead.rows[0];

          // Convert th cells back to td
          Array.from(row.cells).forEach(cell => {
            if (cell.tagName === 'TH') {
              this.convertToTd(cell);
            }
          });

          // Insert at beginning of tbody
          if (tbody.rows.length > 0) {
            tbody.insertBefore(row, tbody.rows[0]);
          } else {
            tbody.appendChild(row);
          }
        }

        // Remove empty thead
        thead.remove();
      }
    }
  }

  private applyColumnHeaders(enable: boolean): void {
    // Get all rows (skip thead rows for column headers)
    const tbody = this.table.tBodies[0];
    const thead = this.table.tHead;

    // Process tbody rows
    if (tbody) {
      Array.from(tbody.rows).forEach(row => {
        const firstCell = row.cells[0];
        if (!firstCell) return;

        if (enable) {
          // Convert first cell to th with scope="row"
          if (firstCell.tagName !== 'TH') {
            const th = this.convertToTh(firstCell);
            th.setAttribute('scope', 'row');
          } else {
            firstCell.setAttribute('scope', 'row');
          }
        } else {
          // Convert first cell back to td if it's a th with scope="row"
          if (firstCell.tagName === 'TH' && firstCell.getAttribute('scope') === 'row') {
            this.convertToTd(firstCell);
          }
        }
      });
    }

    // Handle the corner cell when both row and column headers are set
    if (thead && thead.rows.length > 0) {
      const headerRow = thead.rows[0];
      const cornerCell = headerRow.cells[0];

      if (cornerCell && this.properties.headers === 'both') {
        // Corner cell should be th with scope="col" (row header takes precedence)
        if (cornerCell.tagName !== 'TH') {
          this.convertToTh(cornerCell);
        }
        cornerCell.setAttribute('scope', 'col');
      }
    }
  }

  private convertToTh(cell: HTMLTableCellElement): HTMLTableCellElement {
    const th = document.createElement('th');

    // Copy attributes
    Array.from(cell.attributes).forEach(attr => {
      th.setAttribute(attr.name, attr.value);
    });

    // Copy styles
    th.style.cssText = cell.style.cssText;

    // Move content
    while (cell.firstChild) {
      th.appendChild(cell.firstChild);
    }

    // Replace in DOM
    cell.parentNode?.replaceChild(th, cell);

    return th;
  }

  private convertToTd(cell: HTMLTableCellElement): HTMLTableCellElement {
    const td = document.createElement('td');

    // Copy attributes except scope
    Array.from(cell.attributes).forEach(attr => {
      if (attr.name !== 'scope') {
        td.setAttribute(attr.name, attr.value);
      }
    });

    // Copy styles
    td.style.cssText = cell.style.cssText;

    // Move content
    while (cell.firstChild) {
      td.appendChild(cell.firstChild);
    }

    // Replace in DOM
    cell.parentNode?.replaceChild(td, cell);

    return td;
  }

  private applyTableBorder(): void {
    const { border, borderColor } = this.properties;
    const color = borderColor || '#000000';

    if (border > 0) {
      this.table.setAttribute('border', String(border));
      this.table.style.borderWidth = `${border}px`;
      this.table.style.borderStyle = 'solid';
      this.table.style.borderColor = color;
      this.table.style.borderCollapse = 'collapse';

      // Apply to all cells
      this.table.querySelectorAll('td, th').forEach((cell: Element) => {
        const el = cell as HTMLTableCellElement;
        el.style.borderWidth = `${border}px`;
        el.style.borderStyle = 'solid';
        el.style.borderColor = color;
      });
    } else {
      this.table.removeAttribute('border');
      this.table.style.borderWidth = '';
      this.table.style.borderStyle = '';
      this.table.style.borderColor = '';

      this.table.querySelectorAll('td, th').forEach((cell: Element) => {
        const el = cell as HTMLTableCellElement;
        el.style.borderWidth = '';
        el.style.borderStyle = '';
        el.style.borderColor = '';
      });
    }
  }
}