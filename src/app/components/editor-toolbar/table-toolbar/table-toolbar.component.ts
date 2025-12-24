import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { TableDialogComponent } from '../../dialogs/table-dialog/table-dialog.component';
import { TableOperationsService } from 'src/app/services/table/table-operations.service';
import { CommandExecutorService } from 'src/app/services/command-executor.service';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';
import { CellPropertiesDialogComponent } from '../../dialogs/table/cell-properties-dialog.component';
import { TablePropertiesDialogComponent } from '../../dialogs/table/table-properties-dialog.component';

/**
 * File: src/app/components/editor-toolbar/table-toolbar/table-toolbar.component.ts
 * 
 * Compact Table Toolbar Component
 * - Shows only Insert Table button normally
 * - When in table: shows a single "Table Operations" dropdown with all options
 */
@Component({
  selector: 'ed-table-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatDialogModule
  ],
  template: `
    <div class="table-toolbar-container">
      <!-- Insert Table Button -->
      <button
        mat-icon-button
        matTooltip="Insert Table"
        (click)="openTableDialog()"
        type="button">
        <mat-icon>table_chart</mat-icon>
      </button>

      <!-- Single Table Operations Dropdown (shown when in table) -->
      <button 
        *ngIf="isInTable"
        mat-icon-button 
        [matMenuTriggerFor]="tableOpsMenu"
        matTooltip="Table Operations">
        <mat-icon>more_vert</mat-icon>
      </button>

      <mat-menu #tableOpsMenu="matMenu" class="table-ops-menu">
        <!-- Row Section -->
        <div class="menu-section-label">Row</div>
        <button mat-menu-item (click)="insertRowBefore()">
          <mat-icon>arrow_upward</mat-icon>
          <span>Insert Row Before</span>
        </button>
        <button mat-menu-item (click)="insertRowAfter()">
          <mat-icon>arrow_downward</mat-icon>
          <span>Insert Row After</span>
        </button>
        <button mat-menu-item (click)="deleteRow()" class="danger-item">
          <mat-icon>delete</mat-icon>
          <span>Delete Row</span>
        </button>

        <mat-divider></mat-divider>

        <!-- Column Section -->
        <div class="menu-section-label">Column</div>
        <button mat-menu-item (click)="insertColumnBefore()">
          <mat-icon>arrow_back</mat-icon>
          <span>Insert Column Before</span>
        </button>
        <button mat-menu-item (click)="insertColumnAfter()">
          <mat-icon>arrow_forward</mat-icon>
          <span>Insert Column After</span>
        </button>
        <button mat-menu-item (click)="deleteColumn()" class="danger-item">
          <mat-icon>delete</mat-icon>
          <span>Delete Column</span>
        </button>

        <mat-divider></mat-divider>

        <!-- Cell Section -->
        <div class="menu-section-label">Cell</div>
        <button mat-menu-item (click)="mergeCells()" [disabled]="!canMerge">
          <mat-icon>call_merge</mat-icon>
          <span>Merge Cells</span>
        </button>
        <button mat-menu-item (click)="mergeCellRight()" [disabled]="!canMergeRight">
          <mat-icon>arrow_right_alt</mat-icon>
          <span>Merge Right</span>
        </button>
        <button mat-menu-item (click)="mergeCellDown()" [disabled]="!canMergeDown">
          <mat-icon>south</mat-icon>
          <span>Merge Down</span>
        </button>
        <button mat-menu-item (click)="splitCellHorizontal()" [disabled]="!canSplitH">
          <mat-icon>horizontal_split</mat-icon>
          <span>Split Horizontally</span>
        </button>
        <button mat-menu-item (click)="splitCellVertical()" [disabled]="!canSplitV">
          <mat-icon>vertical_split</mat-icon>
          <span>Split Vertically</span>
        </button>
        <button mat-menu-item (click)="openCellProperties()">
          <mat-icon>tune</mat-icon>
          <span>Cell Properties</span>
        </button>

        <mat-divider></mat-divider>

        <!-- Table Section -->
        <div class="menu-section-label">Table</div>
        <button mat-menu-item (click)="openTableProperties()">
          <mat-icon>settings</mat-icon>
          <span>Table Properties</span>
        </button>
        <button mat-menu-item (click)="deleteTable()" class="danger-item">
          <mat-icon>delete_forever</mat-icon>
          <span>Delete Table</span>
        </button>
      </mat-menu>
    </div>
  `,
  styles: [`
    .table-toolbar-container {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    /* Menu section labels */
    ::ng-deep .table-ops-menu .menu-section-label {
      padding: 8px 16px 4px;
      font-size: 11px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    ::ng-deep .table-ops-menu .mat-menu-item {
      height: 36px;
      line-height: 36px;
      font-size: 13px;
    }

    ::ng-deep .table-ops-menu .mat-menu-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 12px;
      color: #666;
    }

    ::ng-deep .table-ops-menu .mat-menu-item.danger-item,
    ::ng-deep .table-ops-menu .mat-menu-item.danger-item mat-icon {
      color: #d32f2f;
    }

    ::ng-deep .table-ops-menu .mat-menu-item:disabled {
      opacity: 0.5;
    }

    ::ng-deep .table-ops-menu mat-divider {
      margin: 4px 0;
    }
  `]
})
export class TableToolbarComponent implements OnDestroy {
  @Output() commandExecuted = new EventEmitter<void>();

  // Table state
  isInTable = false;
  canMerge = false;
  canMergeRight = false;
  canMergeDown = false;
  canSplitH = false;
  canSplitV = false;

  private destroy$ = new Subject<void>();

  constructor(
    private dialog: MatDialog,
    private tableOps: TableOperationsService,
    private commandExecutor: CommandExecutorService,
    private selectionManager: SelectionManagerService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateState(): void {
    this.isInTable = this.tableOps.isInTable();

    if (this.isInTable) {
      this.canMerge = this.tableOps.canMerge();
      this.canMergeRight = this.tableOps.canMerge('right');
      this.canMergeDown = this.tableOps.canMerge('down');
      this.canSplitH = this.tableOps.canSplit('horizontal');
      this.canSplitV = this.tableOps.canSplit('vertical');
    }
  }

  // Table Insertion
  openTableDialog(): void {
    this.selectionManager.saveSelection();

    const dialogRef = this.dialog.open(TableDialogComponent, {
      data: { maxRows: 20, maxCols: 20 }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.rows && result?.cols) {
        this.insertTable(result.rows, result.cols);
      }
    });
  }

  private insertTable(rows: number, cols: number): void {
    const tableHtml = this.generateTableHtml(rows, cols);
    this.selectionManager.restoreSelection();
    this.commandExecutor.insertHTML(tableHtml);
    this.commandExecuted.emit();
  }

  private generateTableHtml(rows: number, cols: number): string {
    let html = '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td style="border: 1px solid #ddd; padding: 8px;">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</table><p>&nbsp;</p>';
    return html;
  }

  // Row Operations
  insertRowBefore(): void {
    this.tableOps.insertRowBefore();
    this.commandExecuted.emit();
  }

  insertRowAfter(): void {
    this.tableOps.insertRowAfter();
    this.commandExecuted.emit();
  }

  deleteRow(): void {
    this.tableOps.deleteRow();
    this.commandExecuted.emit();
    this.updateState();
  }

  // Column Operations
  insertColumnBefore(): void {
    this.tableOps.insertColumnBefore();
    this.commandExecuted.emit();
  }

  insertColumnAfter(): void {
    this.tableOps.insertColumnAfter();
    this.commandExecuted.emit();
  }

  deleteColumn(): void {
    this.tableOps.deleteColumn();
    this.commandExecuted.emit();
    this.updateState();
  }

  // Cell Operations
  mergeCells(): void {
    this.tableOps.mergeCells();
    this.commandExecuted.emit();
    this.updateState();
  }

  mergeCellRight(): void {
    this.tableOps.mergeCellRight();
    this.commandExecuted.emit();
    this.updateState();
  }

  mergeCellDown(): void {
    this.tableOps.mergeCellDown();
    this.commandExecuted.emit();
    this.updateState();
  }

  splitCellHorizontal(): void {
    this.tableOps.splitCellHorizontal();
    this.commandExecuted.emit();
    this.updateState();
  }

  splitCellVertical(): void {
    this.tableOps.splitCellVertical();
    this.commandExecuted.emit();
    this.updateState();
  }

  // Table Operations
  deleteTable(): void {
    if (confirm('Are you sure you want to delete this table?')) {
      this.tableOps.deleteTable();
      this.commandExecuted.emit();
      this.updateState();
    }
  }

  openTableProperties(): void {
    const table = this.tableOps.getCurrentTable();
    if (!table) return;

    const dialogRef = this.dialog.open(TablePropertiesDialogComponent, {
      data: { table }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.commandExecuted.emit();
      }
    });
  }

  openCellProperties(): void {
    const cells = this.tableOps.getSelectedCells();
    if (cells.length === 0) return;

    const dialogRef = this.dialog.open(CellPropertiesDialogComponent, {
      data: { cells }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.commandExecuted.emit();
      }
    });
  }
}