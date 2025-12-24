import { Component, EventEmitter, Output, ViewChild, ElementRef, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TableOperationsService } from 'src/app/services/table/table-operations.service';

/**
 * File: src/app/components/editor-toolbar/table-context-menu/table-context-menu.component.ts
 */

/**
 * Table Context Menu Actions
 */
export type TableContextAction =
    | 'rowInsertBefore' | 'rowInsertAfter' | 'rowDelete'
    | 'columnInsertBefore' | 'columnInsertAfter' | 'columnDelete'
    | 'cellInsertBefore' | 'cellInsertAfter' | 'cellDelete'
    | 'cellMerge' | 'cellMergeRight' | 'cellMergeDown'
    | 'cellSplitHorizontal' | 'cellSplitVertical'
    | 'cellProperties' | 'tableProperties' | 'tableDelete';

/**
 * Context menu data for table operations
 */
export interface TableContextMenuData {
    isInTable: boolean;
    canMerge: boolean;
    canMergeRight: boolean;
    canMergeDown: boolean;
    canSplitHorizontal: boolean;
    canSplitVertical: boolean;
    selectedCellCount: number;
}

/**
 * Table Context Menu Component
 * 
 * Displays context menu when right-clicking on table cells.
 * Similar to CKEditor 4's table context menu.
 */
@Component({
    selector: 'ed-table-context-menu',
    standalone: true,
    imports: [
        CommonModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule
    ],
    encapsulation: ViewEncapsulation.None,
    template: `
    <!-- Invisible trigger element - positioned at click location -->
    <span 
      #triggerElement
      [matMenuTriggerFor]="tableContextMenu"
      class="context-menu-trigger">
    </span>

    <!-- Main Context Menu -->
    <mat-menu #tableContextMenu="matMenu" class="table-context-menu-panel">
      <!-- Row Submenu -->
      <button mat-menu-item [matMenuTriggerFor]="rowMenu">
        <mat-icon>table_rows</mat-icon>
        <span>Row</span>
      </button>

      <!-- Column Submenu -->
      <button mat-menu-item [matMenuTriggerFor]="columnMenu">
        <mat-icon>view_column</mat-icon>
        <span>Column</span>
      </button>

      <!-- Cell Submenu -->
      <button mat-menu-item [matMenuTriggerFor]="cellMenu">
        <mat-icon>grid_on</mat-icon>
        <span>Cell</span>
      </button>

      <mat-divider></mat-divider>

      <!-- Table Properties -->
      <button mat-menu-item (click)="executeAction('tableProperties')">
        <mat-icon>settings</mat-icon>
        <span>Table Properties</span>
      </button>

      <!-- Delete Table -->
      <button mat-menu-item (click)="executeAction('tableDelete')" class="danger-item">
        <mat-icon>delete</mat-icon>
        <span>Delete Table</span>
      </button>
    </mat-menu>

    <!-- Row Submenu -->
    <mat-menu #rowMenu="matMenu">
      <button mat-menu-item (click)="executeAction('rowInsertBefore')">
        <mat-icon>arrow_upward</mat-icon>
        <span>Insert Row Before</span>
      </button>
      <button mat-menu-item (click)="executeAction('rowInsertAfter')">
        <mat-icon>arrow_downward</mat-icon>
        <span>Insert Row After</span>
      </button>
      <mat-divider></mat-divider>
      <button mat-menu-item (click)="executeAction('rowDelete')" class="danger-item">
        <mat-icon>delete</mat-icon>
        <span>Delete Row</span>
      </button>
    </mat-menu>

    <!-- Column Submenu -->
    <mat-menu #columnMenu="matMenu">
      <button mat-menu-item (click)="executeAction('columnInsertBefore')">
        <mat-icon>arrow_back</mat-icon>
        <span>Insert Column Before</span>
      </button>
      <button mat-menu-item (click)="executeAction('columnInsertAfter')">
        <mat-icon>arrow_forward</mat-icon>
        <span>Insert Column After</span>
      </button>
      <mat-divider></mat-divider>
      <button mat-menu-item (click)="executeAction('columnDelete')" class="danger-item">
        <mat-icon>delete</mat-icon>
        <span>Delete Column</span>
      </button>
    </mat-menu>

    <!-- Cell Submenu -->
    <mat-menu #cellMenu="matMenu">
      <button mat-menu-item (click)="executeAction('cellInsertBefore')">
        <mat-icon>add_box</mat-icon>
        <span>Insert Cell Before</span>
      </button>
      <button mat-menu-item (click)="executeAction('cellInsertAfter')">
        <mat-icon>add_box</mat-icon>
        <span>Insert Cell After</span>
      </button>
      <mat-divider></mat-divider>
      
      <!-- Merge Operations -->
      <button mat-menu-item 
              (click)="executeAction('cellMerge')"
              [disabled]="!contextData?.canMerge">
        <mat-icon>call_merge</mat-icon>
        <span>Merge Cells</span>
      </button>
      <button mat-menu-item 
              (click)="executeAction('cellMergeRight')"
              [disabled]="!contextData?.canMergeRight">
        <mat-icon>arrow_right_alt</mat-icon>
        <span>Merge Right</span>
      </button>
      <button mat-menu-item 
              (click)="executeAction('cellMergeDown')"
              [disabled]="!contextData?.canMergeDown">
        <mat-icon>south</mat-icon>
        <span>Merge Down</span>
      </button>
      
      <mat-divider></mat-divider>
      
      <!-- Split Operations -->
      <button mat-menu-item 
              (click)="executeAction('cellSplitHorizontal')"
              [disabled]="!contextData?.canSplitHorizontal">
        <mat-icon>horizontal_split</mat-icon>
        <span>Split Horizontally</span>
      </button>
      <button mat-menu-item 
              (click)="executeAction('cellSplitVertical')"
              [disabled]="!contextData?.canSplitVertical">
        <mat-icon>vertical_split</mat-icon>
        <span>Split Vertically</span>
      </button>
      
      <mat-divider></mat-divider>
      
      <button mat-menu-item (click)="executeAction('cellProperties')">
        <mat-icon>tune</mat-icon>
        <span>Cell Properties</span>
      </button>
      
      <button mat-menu-item (click)="executeAction('cellDelete')" class="danger-item">
        <mat-icon>delete</mat-icon>
        <span>Delete Cells</span>
      </button>
    </mat-menu>
  `,
    styles: [`
    /* Trigger element - invisible but positioned */
    .context-menu-trigger {
      position: fixed;
      width: 0;
      height: 0;
      opacity: 0;
      pointer-events: none;
    }

    /* Menu panel styling */
    .table-context-menu-panel.mat-menu-panel {
      min-width: 200px;
      max-width: 280px;
    }

    .table-context-menu-panel .mat-menu-content {
      padding: 4px 0;
    }

    .table-context-menu-panel .mat-menu-item {
      height: 40px;
      line-height: 40px;
      font-size: 13px;
    }

    .table-context-menu-panel .mat-menu-item mat-icon {
      margin-right: 12px;
      color: #666;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .table-context-menu-panel .mat-menu-item.danger-item {
      color: #d32f2f;
    }

    .table-context-menu-panel .mat-menu-item.danger-item mat-icon {
      color: #d32f2f;
    }

    .table-context-menu-panel .mat-menu-item:disabled {
      opacity: 0.5;
    }

    .table-context-menu-panel mat-divider {
      margin: 4px 0;
    }
  `]
})
export class TableContextMenuComponent implements AfterViewInit {
    @ViewChild('triggerElement', { static: true }) triggerElement!: ElementRef<HTMLElement>;
    @ViewChild(MatMenuTrigger, { static: true }) menuTrigger!: MatMenuTrigger;

    @Output() actionExecuted = new EventEmitter<TableContextAction>();
    @Output() menuClosed = new EventEmitter<void>();

    contextData: TableContextMenuData | null = null;

    constructor(private tableOps: TableOperationsService) { }

    ngAfterViewInit(): void {
        // Subscribe to menu close event
        this.menuTrigger.menuClosed.subscribe(() => {
            this.menuClosed.emit();
        });
    }

    /**
     * Open the context menu at the specified position
     */
    open(x: number, y: number): void {
        // Position the trigger element at click location
        const trigger = this.triggerElement.nativeElement;
        trigger.style.left = `${x}px`;
        trigger.style.top = `${y}px`;

        // Update context data based on current selection
        this.updateContextData();

        // Open the menu
        this.menuTrigger.openMenu();
    }

    /**
     * Close the context menu
     */
    close(): void {
        this.menuTrigger.closeMenu();
    }

    /**
     * Check if menu is currently open
     */
    isOpen(): boolean {
        return this.menuTrigger?.menuOpen ?? false;
    }

    /**
     * Execute a table action
     */
    executeAction(action: TableContextAction): void {
        switch (action) {
            // Row operations
            case 'rowInsertBefore':
                this.tableOps.insertRowBefore();
                break;
            case 'rowInsertAfter':
                this.tableOps.insertRowAfter();
                break;
            case 'rowDelete':
                this.tableOps.deleteRow();
                break;

            // Column operations
            case 'columnInsertBefore':
                this.tableOps.insertColumnBefore();
                break;
            case 'columnInsertAfter':
                this.tableOps.insertColumnAfter();
                break;
            case 'columnDelete':
                this.tableOps.deleteColumn();
                break;

            // Cell operations
            case 'cellInsertBefore':
                this.tableOps.insertCellBefore();
                break;
            case 'cellInsertAfter':
                this.tableOps.insertCellAfter();
                break;
            case 'cellDelete':
                this.tableOps.deleteCell();
                break;
            case 'cellMerge':
                this.tableOps.mergeCells();
                break;
            case 'cellMergeRight':
                this.tableOps.mergeCellRight();
                break;
            case 'cellMergeDown':
                this.tableOps.mergeCellDown();
                break;
            case 'cellSplitHorizontal':
                this.tableOps.splitCellHorizontal();
                break;
            case 'cellSplitVertical':
                this.tableOps.splitCellVertical();
                break;

            // Table operations
            case 'tableDelete':
                this.tableOps.deleteTable();
                break;

            // Properties dialogs - emitted for parent to handle
            case 'cellProperties':
            case 'tableProperties':
                break;
        }

        this.actionExecuted.emit(action);
    }

    /**
     * Update context data based on current selection
     */
    private updateContextData(): void {
        const selectedCells = this.tableOps.getSelectedCells();

        this.contextData = {
            isInTable: this.tableOps.isInTable(),
            canMerge: this.tableOps.canMerge(),
            canMergeRight: this.tableOps.canMerge('right'),
            canMergeDown: this.tableOps.canMerge('down'),
            canSplitHorizontal: this.tableOps.canSplit('horizontal'),
            canSplitVertical: this.tableOps.canSplit('vertical'),
            selectedCellCount: selectedCells.length
        };
    }
}