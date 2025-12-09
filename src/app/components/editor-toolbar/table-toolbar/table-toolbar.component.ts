import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TableDialogComponent } from '../../dialogs/table-dialog/table-dialog.component';
import { CommandExecutorService } from 'src/app/services/command-executor.service';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';

/**
 * Table Toolbar Component
 * Handles: Table insertion with grid overlay and dialog
 */
@Component({
    selector: 'ed-table-toolbar',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatDialogModule],
    template: `
    <div class="table-button-container">
      <button
        matTooltip="Insert Table"
        mat-icon-button
        (mouseenter)="showTableGrid()"
        (mouseleave)="hideTableGrid()"
        type="button">
        <mat-icon>table_chart</mat-icon>
      </button>

      <!-- Custom table grid overlay -->
      <div class="table-grid-overlay" *ngIf="showGrid" (mouseenter)="keepGridVisible()" (mouseleave)="hideTableGrid()">
        <div class="table-grid-container">
          <div class="grid-preview">{{previewRows}} × {{previewCols}}</div>
          <div class="table-grid">
            <div class="grid-row" *ngFor="let row of getGridRows(); let rowIndex = index">
              <div class="grid-cell"
                   *ngFor="let cell of getGridCols(); let colIndex = index"
                   [class.selected]="isCellSelected(rowIndex, colIndex)"
                   (mouseenter)="onCellHover(rowIndex, colIndex)"
                   (click)="generateTableFromOverlay(rowIndex + 1, colIndex + 1)">
              </div>
            </div>
          </div>
          <div class="grid-footer">
            Hover to preview, click to insert
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .table-button-container {
      position: relative;
      display: inline-block;
    }

    .table-grid-overlay {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      margin-top: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e0e0e0;
      padding: 16px;
      min-width: 280px;
    }

    .table-grid-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .grid-preview {
      font-size: 16px;
      font-weight: 500;
      color: #1976d2;
      padding: 4px 8px;
      background-color: #f5f5f5;
      border-radius: 4px;
      min-width: 60px;
      text-align: center;
    }

    .table-grid {
      display: inline-block;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: white;
      overflow: hidden;
    }

    .grid-row {
      display: flex;
    }

    .grid-cell {
      width: 20px;
      height: 20px;
      border: 1px solid #eee;
      background-color: #fafafa;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: #1976d2;
      }

      &.selected {
        background-color: #1976d2;
        border-color: #0d47a1;
        box-shadow: inset 0 0 0 1px #0d47a1;
      }
    }

    .grid-footer {
      font-size: 12px;
      color: #666;
      text-align: center;
      margin-top: 8px;
    }
  `]
})
export class TableToolbarComponent {
    @Output() commandExecuted = new EventEmitter<void>();

    readonly maxGridRows = 10;
    readonly maxGridCols = 10;
    readonly MAX_TABLE_ROWS = 20;
    readonly MAX_TABLE_COLS = 20;
    readonly OVERLAY_HIDE_DELAY = 200;

    previewRows = 1;
    previewCols = 1;
    showGrid = false;

    gridRows: number[] = [];
    gridCols: number[] = [];

    private gridTimeout: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private dialog: MatDialog,
        private commandExecutor: CommandExecutorService,
        private selectionManager: SelectionManagerService
    ) {
        this.gridRows = Array(this.maxGridRows).fill(0).map((_, i) => i);
        this.gridCols = Array(this.maxGridCols).fill(0).map((_, i) => i);
    }

    getGridRows(): number[] { return this.gridRows; }
    getGridCols(): number[] { return this.gridCols; }

    isCellSelected(rowIndex: number, colIndex: number): boolean {
        return rowIndex < this.previewRows && colIndex < this.previewCols;
    }

    onCellHover(rowIndex: number, colIndex: number): void {
        this.previewRows = rowIndex + 1;
        this.previewCols = colIndex + 1;
    }

    showTableGrid(): void {
        this.selectionManager.saveSelection();
        this.clearTimeout();
        this.showGrid = true;
        this.previewRows = 1;
        this.previewCols = 1;
    }

    hideTableGrid(): void {
        this.clearTimeout();

        this.gridTimeout = setTimeout(() => {
            this.showGrid = false;
            this.previewRows = 1;
            this.previewCols = 1;
            this.gridTimeout = undefined;
        }, this.OVERLAY_HIDE_DELAY);
    }

    keepGridVisible(): void {
        this.clearTimeout();
    }

    generateTableFromOverlay(rows: number, cols: number): void {
        this.showGrid = false;
        this.clearTimeout();

        if (this.selectionManager.isSelectionValid()) {
            this.selectionManager.restoreSelection();
        }

        const tableHTML = this.createTableHTML(rows, cols);
        this.commandExecutor.insertHTML(tableHTML);
        this.commandExecuted.emit();

        this.previewRows = 1;
        this.previewCols = 1;
    }

    insertTableDialog(): void {
        const dialogRef = this.dialog.open(TableDialogComponent, {
            width: '400px',
            data: { maxRows: this.MAX_TABLE_ROWS, maxCols: this.MAX_TABLE_COLS }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.rows && result?.cols) {
                this.generateTable(result.rows, result.cols);
            }
        });
    }

    private generateTable(rows: number, cols: number): void {
        if (rows > this.MAX_TABLE_ROWS || cols > this.MAX_TABLE_COLS || rows < 1 || cols < 1) {
            return;
        }

        const tableHTML = this.createTableHTML(rows, cols);
        this.commandExecutor.insertHTML(tableHTML);
        this.commandExecuted.emit();
    }

    private createTableHTML(rows: number, cols: number): string {
        let html = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 8px 0; border: 1px solid #ddd;">';

        for (let i = 0; i < rows; i++) {
            html += '<tr style="border: 1px solid #ddd;">';
            for (let j = 0; j < cols; j++) {
                html += '<td style="padding: 8px; border: 1px solid #ddd; min-width: 50px; background-color: #fff;">&nbsp;</td>';
            }
            html += '</tr>';
        }

        html += '</table>';
        return html;
    }

    private clearTimeout(): void {
        if (this.gridTimeout !== undefined) {
            clearTimeout(this.gridTimeout);
            this.gridTimeout = undefined;
        }
    }
}