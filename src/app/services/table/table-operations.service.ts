import { Injectable } from '@angular/core';
import { SelectionManagerService } from '../selection-manager.service';

/** 
 * Table cell position interface
 */
export interface CellPosition {
    row: number;
    col: number;
    cell: HTMLTableCellElement;
    rowSpan: number;
    colSpan: number;
}

/**
 * Table map - 2D array representing table structure accounting for rowspan/colspan
 */
export type TableMap = (HTMLTableCellElement | null)[][];

/**
 * Table Operations Service
 * Comprehensive table manipulation similar to CKEditor 4's tabletools plugin
 */
@Injectable({ providedIn: 'root' })
export class TableOperationsService {
    private selectedCells: HTMLTableCellElement[] = [];
    private editorElement: HTMLElement | null = null;

    // Default cell style - used when no reference cell is available
    private readonly DEFAULT_CELL_STYLE = 'border: 1px solid #ddd; padding: 8px;';

    constructor(private selectionManager: SelectionManagerService) { }

    setEditorElement(element: HTMLElement): void {
        this.editorElement = element;
    }

    // ============================================================================
    // STYLE UTILITIES
    // ============================================================================

    /**
     * Get the style from an existing cell in the table, or use default
     */
    private getCellStyle(table: HTMLTableElement): string {
        const existingCell = table.querySelector('td, th') as HTMLTableCellElement;
        if (existingCell && existingCell.style.cssText) {
            return existingCell.style.cssText;
        }
        return this.DEFAULT_CELL_STYLE;
    }

    /**
     * Apply styles to a new cell based on a reference cell or table default
     */
    private applyStylesToCell(
        newCell: HTMLTableCellElement,
        referenceCell?: HTMLTableCellElement | null,
        table?: HTMLTableElement | null
    ): void {
        if (referenceCell && referenceCell.style.cssText) {
            // Copy style from reference cell
            newCell.style.cssText = referenceCell.style.cssText;
        } else if (table) {
            // Use table's existing cell style or default
            newCell.style.cssText = this.getCellStyle(table);
        } else {
            // Fallback to default
            newCell.style.cssText = this.DEFAULT_CELL_STYLE;
        }
    }

    /**
     * Create a styled cell that matches existing table cells
     */
    private createStyledCell(
        row: HTMLTableRowElement,
        insertIndex?: number,
        referenceCell?: HTMLTableCellElement | null
    ): HTMLTableCellElement {
        const newCell = insertIndex !== undefined
            ? row.insertCell(insertIndex)
            : row.insertCell();

        newCell.innerHTML = '&nbsp;';

        const table = row.closest('table') as HTMLTableElement;
        this.applyStylesToCell(newCell, referenceCell, table);

        return newCell;
    }

    // ============================================================================
    // TABLE MAP UTILITIES
    // ============================================================================

    /**
     * Build a table map accounting for rowspan and colspan
     * Similar to CKEDITOR.tools.buildTableMap
     */
    buildTableMap(table: HTMLTableElement): TableMap {
        const rows = table.rows;
        const map: TableMap = [];

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            if (!map[rowIdx]) map[rowIdx] = [];

            const row = rows[rowIdx];
            let colIdx = 0;

            for (let cellIdx = 0; cellIdx < row.cells.length; cellIdx++) {
                const cell = row.cells[cellIdx];
                const rowSpan = cell.rowSpan || 1;
                const colSpan = cell.colSpan || 1;

                // Find next available column in this row
                while (map[rowIdx][colIdx]) colIdx++;

                // Fill in the map for this cell's span
                for (let r = 0; r < rowSpan; r++) {
                    for (let c = 0; c < colSpan; c++) {
                        if (!map[rowIdx + r]) map[rowIdx + r] = [];
                        map[rowIdx + r][colIdx + c] = cell;
                    }
                }
                colIdx += colSpan;
            }
        }
        return map;
    }

    /**
     * Get cell position in the table map
     */
    getCellPosition(cell: HTMLTableCellElement): CellPosition | null {
        const table = cell.closest('table') as HTMLTableElement;
        if (!table) return null;

        const map = this.buildTableMap(table);
        const row = (cell.parentElement as HTMLTableRowElement)?.rowIndex ?? -1;

        for (let col = 0; col < map[row]?.length; col++) {
            if (map[row][col] === cell) {
                return {
                    row,
                    col,
                    cell,
                    rowSpan: cell.rowSpan || 1,
                    colSpan: cell.colSpan || 1
                };
            }
        }
        return null;
    }

    /**
     * Get all cells in a column
     */
    getColumnCells(table: HTMLTableElement, colIndex: number): HTMLTableCellElement[] {
        const map = this.buildTableMap(table);
        const cells: HTMLTableCellElement[] = [];
        const seen = new Set<HTMLTableCellElement>();

        for (let row = 0; row < map.length; row++) {
            const cell = map[row]?.[colIndex];
            if (cell && !seen.has(cell)) {
                seen.add(cell);
                cells.push(cell);
            }
        }
        return cells;
    }

    /**
     * Get all cells in a row
     */
    getRowCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
        return Array.from(row.cells);
    }

    // ============================================================================
    // SELECTION MANAGEMENT
    // ============================================================================

    /**
     * Get currently selected cells
     */
    getSelectedCells(): HTMLTableCellElement[] {
        if (this.selectedCells.length > 0) return [...this.selectedCells];

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return [];

        const range = selection.getRangeAt(0);
        const cell = this.findAncestorCell(range.commonAncestorContainer);

        return cell ? [cell] : [];
    }

    /**
     * Set selected cells with visual feedback
     */
    setSelectedCells(cells: HTMLTableCellElement[]): void {
        this.clearCellSelection();
        this.selectedCells = cells;
        cells.forEach(cell => cell.classList.add('table-cell-selected'));
    }

    /**
     * Clear cell selection
     */
    clearCellSelection(): void {
        this.selectedCells.forEach(cell => cell.classList.remove('table-cell-selected'));
        this.selectedCells = [];
    }

    /**
     * Select cells in a range (for drag selection)
     */
    selectCellRange(startCell: HTMLTableCellElement, endCell: HTMLTableCellElement): void {
        const table = startCell.closest('table') as HTMLTableElement;
        if (!table || table !== endCell.closest('table')) return;

        const startPos = this.getCellPosition(startCell);
        const endPos = this.getCellPosition(endCell);
        if (!startPos || !endPos) return;

        const minRow = Math.min(startPos.row, endPos.row);
        const maxRow = Math.max(startPos.row + startPos.rowSpan - 1, endPos.row + endPos.rowSpan - 1);
        const minCol = Math.min(startPos.col, endPos.col);
        const maxCol = Math.max(startPos.col + startPos.colSpan - 1, endPos.col + endPos.colSpan - 1);

        const map = this.buildTableMap(table);
        const cells = new Set<HTMLTableCellElement>();

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cell = map[r]?.[c];
                if (cell) cells.add(cell);
            }
        }

        this.setSelectedCells(Array.from(cells));
    }

    /**
     * Find ancestor table cell element
     */
    findAncestorCell(node: Node | null): HTMLTableCellElement | null {
        let current: Node | null = node;
        while (current && current !== this.editorElement) {
            if (current.nodeName === 'TD' || current.nodeName === 'TH') {
                return current as HTMLTableCellElement;
            }
            current = current.parentNode;
        }
        return null;
    }

    /**
     * Find ancestor table element
     */
    findAncestorTable(node: Node | null): HTMLTableElement | null {
        let current: Node | null = node;
        while (current && current !== this.editorElement) {
            if (current.nodeName === 'TABLE') {
                return current as HTMLTableElement;
            }
            current = current.parentNode;
        }
        return null;
    }

    // ============================================================================
    // ROW OPERATIONS - FIXED WITH STYLE COPYING
    // ============================================================================

    /**
     * Insert row before selected row(s)
     */
    insertRowBefore(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const cell = cells[0];
        const table = cell.closest('table') as HTMLTableElement;
        const row = cell.parentElement as HTMLTableRowElement;
        if (!table || !row) return;

        const map = this.buildTableMap(table);
        const rowIndex = row.rowIndex;
        const newRow = table.insertRow(rowIndex);

        // Determine number of columns from the map
        const colCount = map[rowIndex]?.length || row.cells.length;

        // Create cells, handling colspan from row above
        const processedCols = new Set<number>();
        for (let col = 0; col < colCount; col++) {
            if (processedCols.has(col)) continue;

            const cellAbove = rowIndex > 0 ? map[rowIndex - 1]?.[col] : null;
            const cellAtRow = map[rowIndex]?.[col];

            // Check if cell from above spans into this row
            if (cellAbove && cellAtRow === cellAbove && cellAbove.rowSpan > 1) {
                cellAbove.rowSpan++;
                for (let c = col; c < col + (cellAbove.colSpan || 1); c++) {
                    processedCols.add(c);
                }
            } else {
                // Create new cell with proper styling
                const referenceCell = cellAtRow || map[rowIndex]?.[0];
                const newCell = this.createStyledCell(newRow, undefined, referenceCell);

                if (cellAtRow && cellAtRow.colSpan > 1) {
                    newCell.colSpan = cellAtRow.colSpan;
                    for (let c = col + 1; c < col + cellAtRow.colSpan; c++) {
                        processedCols.add(c);
                    }
                }
            }
        }

        this.positionCursorInCell(newRow.cells[0]);
    }

    /**
     * Insert row after selected row(s)
     */
    insertRowAfter(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const lastCell = cells[cells.length - 1];
        const table = lastCell.closest('table') as HTMLTableElement;
        const row = lastCell.parentElement as HTMLTableRowElement;
        if (!table || !row) return;

        const map = this.buildTableMap(table);
        const rowIndex = row.rowIndex;

        // Find the actual last row considering rowspan
        let lastRowIndex = rowIndex;
        for (const cell of cells) {
            const pos = this.getCellPosition(cell);
            if (pos) {
                lastRowIndex = Math.max(lastRowIndex, pos.row + pos.rowSpan - 1);
            }
        }

        const newRow = table.insertRow(lastRowIndex + 1);
        const colCount = map[lastRowIndex]?.length || row.cells.length;

        const processedCols = new Set<number>();
        for (let col = 0; col < colCount; col++) {
            if (processedCols.has(col)) continue;

            const cellAtRow = map[lastRowIndex]?.[col];

            // Check if cell spans beyond this row
            if (cellAtRow) {
                const cellPos = this.getCellPosition(cellAtRow);
                if (cellPos && cellPos.row + cellPos.rowSpan - 1 > lastRowIndex) {
                    cellAtRow.rowSpan++;
                    for (let c = col; c < col + (cellAtRow.colSpan || 1); c++) {
                        processedCols.add(c);
                    }
                    continue;
                }
            }

            // Create new cell with proper styling
            const referenceCell = cellAtRow || map[lastRowIndex]?.[0];
            const newCell = this.createStyledCell(newRow, undefined, referenceCell);

            if (cellAtRow && cellAtRow.colSpan > 1) {
                newCell.colSpan = cellAtRow.colSpan;
                for (let c = col + 1; c < col + cellAtRow.colSpan; c++) {
                    processedCols.add(c);
                }
            }
        }

        this.positionCursorInCell(newRow.cells[0]);
    }

    /**
     * Delete selected row(s)
     */
    deleteRow(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const table = cells[0].closest('table') as HTMLTableElement;
        if (!table) return;

        // Get unique rows to delete
        const rowsToDelete = new Set<HTMLTableRowElement>();
        cells.forEach(cell => {
            const row = cell.parentElement as HTMLTableRowElement;
            if (row) rowsToDelete.add(row);
        });

        // Sort rows by index descending to delete from bottom up
        const sortedRows = Array.from(rowsToDelete).sort((a, b) => b.rowIndex - a.rowIndex);

        // Check if we're deleting all rows
        if (sortedRows.length >= table.rows.length) {
            table.remove();
            return;
        }

        const map = this.buildTableMap(table);

        sortedRows.forEach(row => {
            const rowIndex = row.rowIndex;

            // Handle cells that span into this row from above
            for (let col = 0; col < map[rowIndex]?.length; col++) {
                const cell = map[rowIndex][col];
                if (!cell) continue;

                const cellRow = (cell.parentElement as HTMLTableRowElement)?.rowIndex;
                if (cellRow !== undefined && cellRow < rowIndex && cell.rowSpan > 1) {
                    cell.rowSpan--;
                }

                // Handle cells that span below this row
                if (cellRow === rowIndex && cell.rowSpan > 1) {
                    const nextRow = table.rows[rowIndex + 1];
                    if (nextRow) {
                        const newCell = cell.cloneNode(true) as HTMLTableCellElement;
                        newCell.rowSpan = cell.rowSpan - 1;
                        // Style is preserved via cloneNode

                        // Find correct position in next row
                        let insertIndex = 0;
                        for (let c = 0; c < col; c++) {
                            if (map[rowIndex + 1]?.[c] !== map[rowIndex]?.[c]) {
                                insertIndex++;
                            }
                        }

                        if (insertIndex < nextRow.cells.length) {
                            nextRow.insertBefore(newCell, nextRow.cells[insertIndex]);
                        } else {
                            nextRow.appendChild(newCell);
                        }
                    }
                }
            }

            row.remove();
        });

        this.clearCellSelection();
    }

    // ============================================================================
    // COLUMN OPERATIONS - FIXED WITH STYLE COPYING
    // ============================================================================

    /**
     * Insert column before selected column(s)
     */
    insertColumnBefore(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const cell = cells[0];
        const table = cell.closest('table') as HTMLTableElement;
        if (!table) return;

        const pos = this.getCellPosition(cell);
        if (!pos) return;

        const map = this.buildTableMap(table);
        const colIndex = pos.col;
        const processedRows = new Set<number>();

        for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
            if (processedRows.has(rowIdx)) continue;

            const row = table.rows[rowIdx];
            const cellAtCol = map[rowIdx]?.[colIndex];

            if (cellAtCol) {
                const cellPos = this.getCellPosition(cellAtCol);

                // Check if cell spans from a previous column
                if (cellPos && cellPos.col < colIndex) {
                    cellAtCol.colSpan++;
                    // Mark all rows this cell spans as processed
                    for (let r = cellPos.row; r < cellPos.row + cellPos.rowSpan; r++) {
                        processedRows.add(r);
                    }
                } else {
                    // Find insert position in the DOM row
                    let insertIdx = 0;
                    for (let c = 0; c < colIndex; c++) {
                        const prevCell = map[rowIdx]?.[c];
                        if (prevCell && (prevCell.parentElement as HTMLTableRowElement)?.rowIndex === rowIdx) {
                            const prevPos = this.getCellPosition(prevCell);
                            if (prevPos && prevPos.col === c) insertIdx++;
                        }
                    }

                    // Create new cell with proper styling
                    const newCell = this.createStyledCell(row, insertIdx, cellAtCol);

                    if (cellAtCol.rowSpan > 1) {
                        newCell.rowSpan = cellAtCol.rowSpan;
                        for (let r = rowIdx + 1; r < rowIdx + cellAtCol.rowSpan; r++) {
                            processedRows.add(r);
                        }
                    }
                }
            } else {
                // Create new cell with table default styling
                this.createStyledCell(row, 0, map[rowIdx]?.[0]);
            }
        }
    }

    /**
     * Insert column after selected column(s)
     */
    insertColumnAfter(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const lastCell = cells[cells.length - 1];
        const table = lastCell.closest('table') as HTMLTableElement;
        if (!table) return;

        const pos = this.getCellPosition(lastCell);
        if (!pos) return;

        const map = this.buildTableMap(table);
        const colIndex = pos.col + pos.colSpan - 1;
        const processedRows = new Set<number>();

        for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
            if (processedRows.has(rowIdx)) continue;

            const row = table.rows[rowIdx];
            const cellAtCol = map[rowIdx]?.[colIndex];

            if (cellAtCol) {
                const cellPos = this.getCellPosition(cellAtCol);

                // Check if cell spans beyond this column
                if (cellPos && cellPos.col + cellPos.colSpan - 1 > colIndex) {
                    cellAtCol.colSpan++;
                    for (let r = cellPos.row; r < cellPos.row + cellPos.rowSpan; r++) {
                        processedRows.add(r);
                    }
                } else {
                    // Find insert position
                    let insertIdx = 0;
                    for (let c = 0; c <= colIndex; c++) {
                        const prevCell = map[rowIdx]?.[c];
                        if (prevCell && (prevCell.parentElement as HTMLTableRowElement)?.rowIndex === rowIdx) {
                            const prevPos = this.getCellPosition(prevCell);
                            if (prevPos && prevPos.col === c) insertIdx++;
                        }
                    }

                    // Create new cell with proper styling
                    const newCell = this.createStyledCell(row, insertIdx, cellAtCol);

                    if (cellAtCol.rowSpan > 1) {
                        newCell.rowSpan = cellAtCol.rowSpan;
                        for (let r = rowIdx + 1; r < rowIdx + cellAtCol.rowSpan; r++) {
                            processedRows.add(r);
                        }
                    }
                }
            } else {
                // Create new cell with table default styling
                this.createStyledCell(row, undefined, map[rowIdx]?.[0]);
            }
        }
    }

    /**
     * Delete selected column(s)
     */
    deleteColumn(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const table = cells[0].closest('table') as HTMLTableElement;
        if (!table) return;

        // Get column indices to delete
        const colsToDelete = new Set<number>();
        cells.forEach(cell => {
            const pos = this.getCellPosition(cell);
            if (pos) {
                for (let c = pos.col; c < pos.col + pos.colSpan; c++) {
                    colsToDelete.add(c);
                }
            }
        });

        const map = this.buildTableMap(table);
        const totalCols = map[0]?.length || 0;

        // Check if deleting all columns
        if (colsToDelete.size >= totalCols) {
            table.remove();
            return;
        }

        // Delete columns from right to left
        const sortedCols = Array.from(colsToDelete).sort((a, b) => b - a);

        sortedCols.forEach(colIdx => {
            const processedCells = new Set<HTMLTableCellElement>();

            for (let rowIdx = 0; rowIdx < map.length; rowIdx++) {
                const cell = map[rowIdx]?.[colIdx];
                if (!cell || processedCells.has(cell)) continue;

                processedCells.add(cell);
                const pos = this.getCellPosition(cell);

                if (pos) {
                    if (pos.colSpan > 1) {
                        cell.colSpan--;
                    } else {
                        cell.remove();
                    }
                }
            }
        });

        this.clearCellSelection();
    }

    // ============================================================================
    // CELL OPERATIONS - FIXED WITH STYLE COPYING
    // ============================================================================

    /**
     * Insert cell before selected cell
     */
    insertCellBefore(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const cell = cells[0];
        const row = cell.parentElement as HTMLTableRowElement;
        if (!row) return;

        const cellIndex = cell.cellIndex;
        const newCell = this.createStyledCell(row, cellIndex, cell);

        this.positionCursorInCell(newCell);
    }

    /**
     * Insert cell after selected cell
     */
    insertCellAfter(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const cell = cells[cells.length - 1];
        const row = cell.parentElement as HTMLTableRowElement;
        if (!row) return;

        const cellIndex = cell.cellIndex + 1;
        const newCell = this.createStyledCell(row, cellIndex, cell);

        this.positionCursorInCell(newCell);
    }

    /**
     * Delete selected cells
     */
    deleteCell(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        cells.forEach(cell => cell.remove());
        this.clearCellSelection();
    }

    /**
     * Merge selected cells
     */
    mergeCells(): HTMLTableCellElement | null {
        const cells = this.getSelectedCells();
        if (cells.length < 2) return null;

        const table = cells[0].closest('table') as HTMLTableElement;
        if (!table) return null;

        // Get bounding rectangle of selected cells
        let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1;

        cells.forEach(cell => {
            const pos = this.getCellPosition(cell);
            if (pos) {
                minRow = Math.min(minRow, pos.row);
                maxRow = Math.max(maxRow, pos.row + pos.rowSpan - 1);
                minCol = Math.min(minCol, pos.col);
                maxCol = Math.max(maxCol, pos.col + pos.colSpan - 1);
            }
        });

        const map = this.buildTableMap(table);

        // Verify all cells in the rectangle are selected (rectangular selection)
        const cellsInRect = new Set<HTMLTableCellElement>();
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cell = map[r]?.[c];
                if (cell) cellsInRect.add(cell);
            }
        }

        // Check if it's a valid rectangular selection
        if (cellsInRect.size !== cells.length) {
            console.warn('Cannot merge: selection is not rectangular');
            return null;
        }

        // Merge content and remove other cells
        const firstCell = cells[0];
        let content = '';

        cells.forEach((cell, index) => {
            const cellContent = cell.innerHTML.trim();
            if (cellContent && cellContent !== '&nbsp;' && cellContent !== '<br>') {
                if (content) content += '<br>';
                content += cellContent;
            }
            if (index > 0) cell.remove();
        });

        firstCell.innerHTML = content || '&nbsp;';
        firstCell.rowSpan = maxRow - minRow + 1;
        firstCell.colSpan = maxCol - minCol + 1;

        this.clearCellSelection();
        this.positionCursorInCell(firstCell);

        return firstCell;
    }

    /**
     * Merge cell to the right
     */
    mergeCellRight(): HTMLTableCellElement | null {
        const cells = this.getSelectedCells();
        if (cells.length !== 1) return null;

        const cell = cells[0];
        const pos = this.getCellPosition(cell);
        if (!pos) return null;

        const table = cell.closest('table') as HTMLTableElement;
        if (!table) return null;

        const map = this.buildTableMap(table);
        const nextColIndex = pos.col + pos.colSpan;
        const nextCell = map[pos.row]?.[nextColIndex];

        if (!nextCell || nextCell.rowSpan !== pos.rowSpan) {
            console.warn('Cannot merge right: no compatible cell');
            return null;
        }

        this.setSelectedCells([cell, nextCell]);
        return this.mergeCells();
    }

    /**
     * Merge cell down
     */
    mergeCellDown(): HTMLTableCellElement | null {
        const cells = this.getSelectedCells();
        if (cells.length !== 1) return null;

        const cell = cells[0];
        const pos = this.getCellPosition(cell);
        if (!pos) return null;

        const table = cell.closest('table') as HTMLTableElement;
        if (!table) return null;

        const map = this.buildTableMap(table);
        const nextRowIndex = pos.row + pos.rowSpan;
        const nextCell = map[nextRowIndex]?.[pos.col];

        if (!nextCell || nextCell.colSpan !== pos.colSpan) {
            console.warn('Cannot merge down: no compatible cell');
            return null;
        }

        this.setSelectedCells([cell, nextCell]);
        return this.mergeCells();
    }

    /**
     * Split cell horizontally (increase rows)
     */
    splitCellHorizontal(): void {
        const cells = this.getSelectedCells();
        if (cells.length !== 1) return;

        const cell = cells[0];
        if (cell.rowSpan <= 1) {
            // Need to add a new row and adjust other cells
            this.insertRowAfter();
            return;
        }

        const table = cell.closest('table') as HTMLTableElement;
        if (!table) return;

        const pos = this.getCellPosition(cell);
        if (!pos) return;

        // Create new cell in the row below
        const newRowSpan = Math.floor(cell.rowSpan / 2);
        const remainingSpan = cell.rowSpan - newRowSpan;

        cell.rowSpan = newRowSpan;

        const targetRow = table.rows[pos.row + newRowSpan];
        if (!targetRow) return;

        // Find correct insert position
        const map = this.buildTableMap(table);
        let insertIdx = 0;
        for (let c = 0; c < pos.col; c++) {
            const cellAtCol = map[pos.row + newRowSpan]?.[c];
            if (cellAtCol && (cellAtCol.parentElement as HTMLTableRowElement)?.rowIndex === pos.row + newRowSpan) {
                insertIdx++;
            }
        }

        // Create new cell with styling from original cell
        const newCell = this.createStyledCell(targetRow, insertIdx, cell);
        newCell.rowSpan = remainingSpan;
        newCell.colSpan = cell.colSpan;

        this.positionCursorInCell(cell);
    }

    /**
     * Split cell vertically (increase columns)
     */
    splitCellVertical(): void {
        const cells = this.getSelectedCells();
        if (cells.length !== 1) return;

        const cell = cells[0];
        if (cell.colSpan <= 1) {
            // Need to add a new column
            this.insertColumnAfter();
            return;
        }

        const newColSpan = Math.floor(cell.colSpan / 2);
        const remainingSpan = cell.colSpan - newColSpan;

        cell.colSpan = newColSpan;

        const row = cell.parentElement as HTMLTableRowElement;

        // Create new cell with styling from original cell
        const newCell = this.createStyledCell(row, cell.cellIndex + 1, cell);
        newCell.colSpan = remainingSpan;
        newCell.rowSpan = cell.rowSpan;

        this.positionCursorInCell(cell);
    }

    // ============================================================================
    // TABLE OPERATIONS
    // ============================================================================

    /**
     * Delete the entire table
     */
    deleteTable(): void {
        const cells = this.getSelectedCells();
        if (cells.length === 0) return;

        const table = cells[0].closest('table');
        if (table) {
            table.remove();
            this.clearCellSelection();
        }
    }

    /**
     * Check if merge is possible for current selection
     */
    canMerge(direction?: 'right' | 'down'): boolean {
        const cells = this.getSelectedCells();

        if (direction === 'right' || direction === 'down') {
            if (cells.length !== 1) return false;

            const cell = cells[0];
            const pos = this.getCellPosition(cell);
            if (!pos) return false;

            const table = cell.closest('table') as HTMLTableElement;
            if (!table) return false;

            const map = this.buildTableMap(table);

            if (direction === 'right') {
                const nextCell = map[pos.row]?.[pos.col + pos.colSpan];
                return !!nextCell && nextCell.rowSpan === pos.rowSpan;
            } else {
                const nextCell = map[pos.row + pos.rowSpan]?.[pos.col];
                return !!nextCell && nextCell.colSpan === pos.colSpan;
            }
        }

        return cells.length >= 2;
    }

    /**
     * Check if split is possible
     */
    canSplit(direction: 'horizontal' | 'vertical'): boolean {
        const cells = this.getSelectedCells();
        if (cells.length !== 1) return false;

        const cell = cells[0];
        return direction === 'horizontal' ? cell.rowSpan > 1 : cell.colSpan > 1;
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Position cursor inside a cell
     */
    private positionCursorInCell(cell: HTMLTableCellElement): void {
        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();

        if (cell.firstChild) {
            range.setStart(cell.firstChild, 0);
            range.collapse(true);
        } else {
            range.setStart(cell, 0);
            range.collapse(true);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Check if cursor is inside a table
     */
    isInTable(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        return !!this.findAncestorTable(range.commonAncestorContainer);
    }

    /**
     * Get the table containing current selection
     */
    getCurrentTable(): HTMLTableElement | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0);
        return this.findAncestorTable(range.commonAncestorContainer);
    }
}