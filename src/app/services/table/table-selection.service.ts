import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { TableOperationsService } from './table-operations.service';

/**
 * Table Selection Service
 * 
 * Handles cell selection via mouse drag similar to CKEditor 4's tableselection plugin.
 * Provides visual feedback for selected cells and manages selection state.
 */
@Injectable({ providedIn: 'root' })
export class TableSelectionService implements OnDestroy {
    private editorElement: HTMLElement | null = null;
    private isSelecting = false;
    private startCell: HTMLTableCellElement | null = null;
    private currentTable: HTMLTableElement | null = null;

    // Event subjects
    readonly selectionChanged$ = new Subject<HTMLTableCellElement[]>();

    // Bound event handlers (for proper removal)
    private boundMouseDown = this.onMouseDown.bind(this);
    private boundMouseMove = this.onMouseMove.bind(this);
    private boundMouseUp = this.onMouseUp.bind(this);
    private boundKeyDown = this.onKeyDown.bind(this);

    constructor(private tableOps: TableOperationsService) { }

    ngOnDestroy(): void {
        this.detach();
    }

    /**
     * Initialize table selection handling for an editor
     */
    attach(editorElement: HTMLElement): void {
        this.editorElement = editorElement;
        this.tableOps.setEditorElement(editorElement);

        // Add event listeners
        editorElement.addEventListener('mousedown', this.boundMouseDown);
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
        editorElement.addEventListener('keydown', this.boundKeyDown);
    }

    /**
     * Remove event listeners
     */
    detach(): void {
        if (this.editorElement) {
            this.editorElement.removeEventListener('mousedown', this.boundMouseDown);
            this.editorElement.removeEventListener('keydown', this.boundKeyDown);
        }
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);

        this.tableOps.clearCellSelection();
        this.editorElement = null;
    }

    /**
     * Get currently selected cells
     */
    getSelectedCells(): HTMLTableCellElement[] {
        return this.tableOps.getSelectedCells();
    }

    /**
     * Clear current selection
     */
    clearSelection(): void {
        this.tableOps.clearCellSelection();
        this.selectionChanged$.next([]);
    }

    /**
     * Select a range of cells
     */
    selectRange(startCell: HTMLTableCellElement, endCell: HTMLTableCellElement): void {
        this.tableOps.selectCellRange(startCell, endCell);
        this.selectionChanged$.next(this.tableOps.getSelectedCells());
    }

    /**
     * Select entire row
     */
    selectRow(cell: HTMLTableCellElement): void {
        const row = cell.parentElement as HTMLTableRowElement;
        if (!row) return;

        const cells = Array.from(row.cells);
        this.tableOps.setSelectedCells(cells);
        this.selectionChanged$.next(cells);
    }

    /**
     * Select entire column
     */
    selectColumn(cell: HTMLTableCellElement): void {
        const table = cell.closest('table') as HTMLTableElement;
        if (!table) return;

        const pos = this.tableOps.getCellPosition(cell);
        if (!pos) return;

        const cells = this.tableOps.getColumnCells(table, pos.col);
        this.tableOps.setSelectedCells(cells);
        this.selectionChanged$.next(cells);
    }

    /**
     * Select entire table
     */
    selectTable(table: HTMLTableElement): void {
        const cells: HTMLTableCellElement[] = [];
        for (let r = 0; r < table.rows.length; r++) {
            for (let c = 0; c < table.rows[r].cells.length; c++) {
                cells.push(table.rows[r].cells[c]);
            }
        }
        this.tableOps.setSelectedCells(cells);
        this.selectionChanged$.next(cells);
    }

    // ============================================================================
    // PRIVATE EVENT HANDLERS
    // ============================================================================

    private onMouseDown(event: MouseEvent): void {
        // Only handle left mouse button
        if (event.button !== 0) return;

        const target = event.target as HTMLElement;
        const cell = this.tableOps.findAncestorCell(target);

        if (!cell) {
            // Clicked outside table - clear selection
            if (this.tableOps.getSelectedCells().length > 0) {
                this.clearSelection();
            }
            return;
        }

        const table = cell.closest('table') as HTMLTableElement;
        if (!table) return;

        // Check for Ctrl+Click to add to selection
        if (event.ctrlKey || event.metaKey) {
            const currentSelection = this.tableOps.getSelectedCells();
            if (currentSelection.includes(cell)) {
                // Remove from selection
                const newSelection = currentSelection.filter(c => c !== cell);
                this.tableOps.setSelectedCells(newSelection);
            } else {
                // Add to selection
                this.tableOps.setSelectedCells([...currentSelection, cell]);
            }
            this.selectionChanged$.next(this.tableOps.getSelectedCells());
            event.preventDefault();
            return;
        }

        // Check for Shift+Click for range selection
        if (event.shiftKey && this.startCell) {
            this.selectRange(this.startCell, cell);
            event.preventDefault();
            return;
        }

        // Start new selection
        this.isSelecting = true;
        this.startCell = cell;
        this.currentTable = table;

        // Select the clicked cell
        this.tableOps.setSelectedCells([cell]);
        this.selectionChanged$.next([cell]);
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isSelecting || !this.startCell || !this.currentTable) return;

        const target = event.target as HTMLElement;
        const cell = this.tableOps.findAncestorCell(target);

        if (!cell || cell.closest('table') !== this.currentTable) return;

        // Prevent text selection during cell selection
        event.preventDefault();

        // Update selection range
        this.selectRange(this.startCell, cell);
    }

    private onMouseUp(event: MouseEvent): void {
        if (this.isSelecting) {
            this.isSelecting = false;
            // Keep startCell for Shift+Click
        }
    }

    private onKeyDown(event: KeyboardEvent): void {
        const selectedCells = this.tableOps.getSelectedCells();
        if (selectedCells.length === 0) return;

        // Handle Escape to clear selection
        if (event.key === 'Escape') {
            this.clearSelection();
            return;
        }

        // Handle Ctrl+A to select all cells in table
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            const table = selectedCells[0].closest('table') as HTMLTableElement;
            if (table) {
                event.preventDefault();
                this.selectTable(table);
            }
            return;
        }

        // Handle arrow keys for navigation
        if (selectedCells.length === 1 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            const cell = selectedCells[0];
            const table = cell.closest('table') as HTMLTableElement;
            if (!table) return;

            const pos = this.tableOps.getCellPosition(cell);
            if (!pos) return;

            const map = this.tableOps.buildTableMap(table);
            let newRow = pos.row;
            let newCol = pos.col;

            switch (event.key) {
                case 'ArrowUp':
                    newRow = Math.max(0, pos.row - 1);
                    break;
                case 'ArrowDown':
                    newRow = Math.min(map.length - 1, pos.row + pos.rowSpan);
                    break;
                case 'ArrowLeft':
                    newCol = Math.max(0, pos.col - 1);
                    break;
                case 'ArrowRight':
                    newCol = Math.min((map[0]?.length || 1) - 1, pos.col + pos.colSpan);
                    break;
            }

            const newCell = map[newRow]?.[newCol];
            if (newCell && newCell !== cell) {
                if (event.shiftKey) {
                    // Extend selection
                    this.selectRange(this.startCell || cell, newCell);
                } else {
                    // Move to new cell
                    this.tableOps.setSelectedCells([newCell]);
                    this.startCell = newCell;
                    this.selectionChanged$.next([newCell]);

                    // Move cursor into the cell
                    const range = document.createRange();
                    const selection = window.getSelection();
                    if (newCell.firstChild) {
                        range.setStart(newCell.firstChild, 0);
                    } else {
                        range.setStart(newCell, 0);
                    }
                    range.collapse(true);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
                event.preventDefault();
            }
        }

        // Handle Tab key for cell navigation
        if (event.key === 'Tab') {
            const cell = selectedCells[selectedCells.length - 1];
            const table = cell.closest('table') as HTMLTableElement;
            if (!table) return;

            const pos = this.tableOps.getCellPosition(cell);
            if (!pos) return;

            const map = this.tableOps.buildTableMap(table);
            const totalCols = map[0]?.length || 0;

            let newRow = pos.row;
            let newCol = pos.col + pos.colSpan;

            if (event.shiftKey) {
                // Move backwards
                newCol = pos.col - 1;
                if (newCol < 0) {
                    newRow--;
                    newCol = totalCols - 1;
                }
            } else {
                // Move forwards
                if (newCol >= totalCols) {
                    newRow++;
                    newCol = 0;
                }
            }

            if (newRow >= 0 && newRow < map.length) {
                const newCell = map[newRow]?.[newCol];
                if (newCell) {
                    this.tableOps.setSelectedCells([newCell]);
                    this.startCell = newCell;
                    this.selectionChanged$.next([newCell]);

                    // Move cursor and select cell content
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(newCell);
                    selection?.removeAllRanges();
                    selection?.addRange(range);

                    event.preventDefault();
                }
            } else if (!event.shiftKey && newRow >= map.length) {
                // At the end - optionally add new row
                this.tableOps.insertRowAfter();
                const lastRow = table.rows[table.rows.length - 1];
                if (lastRow?.cells[0]) {
                    const newCell = lastRow.cells[0];
                    this.tableOps.setSelectedCells([newCell]);
                    this.startCell = newCell;
                    this.selectionChanged$.next([newCell]);
                }
                event.preventDefault();
            }
        }

        // Handle Delete/Backspace to clear cell content
        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedCells.length > 0) {
            // Only prevent if multiple cells selected
            if (selectedCells.length > 1) {
                event.preventDefault();
                selectedCells.forEach(c => {
                    c.innerHTML = '&nbsp;';
                });
            }
        }
    }
}