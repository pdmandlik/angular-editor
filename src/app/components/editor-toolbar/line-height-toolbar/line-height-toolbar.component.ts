import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';

/**
 * Line Height Toolbar Component
 * Handles: Line height selection with grid overlay
 */
@Component({
    selector: 'ed-line-height-toolbar',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, ReactiveFormsModule],
    template: `
    <div class="line-height-button-container">
      <button
        [matTooltip]="'Line Height (' + (lineHeight.value || '1.5') + ')'"
        mat-icon-button
        (mouseenter)="showLineHeightGrid()"
        (mouseleave)="hideLineHeightGrid()"
        type="button"
        class="line-height-button">
        <mat-icon>format_line_spacing</mat-icon>
      </button>

      <!-- Custom line height grid overlay -->
      <div class="line-height-grid-overlay" 
           *ngIf="showLineHeightGridFlag" 
           (mouseenter)="keepLineHeightGridVisible()" 
           (mouseleave)="hideLineHeightGrid()">
        <div class="line-height-grid-container">
          <div class="grid-title">Line Height</div>
          <div class="line-height-grid">
            <div class="height-option"
                 *ngFor="let height of lineHeights"
                 [class.selected]="height === lineHeight.value"
                 (mousedown)="$event.preventDefault(); selectLineHeight(height)"
                 [attr.data-height]="height"
                 [style.line-height]="height">
              {{height}}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .line-height-button-container {
      position: relative;
      display: inline-block;
    }

    .line-height-grid-overlay {
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
      padding: 8px;
      min-width: 60px;
    }

    .line-height-grid-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .grid-title {
      font-size: 12px;
      font-weight: 500;
      color: #666;
      margin: 0;
    }

    .line-height-grid {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .height-option {
      width: 40px;
      height: 24px;
      background-color: #fafafa;
      border: 1px solid #eee;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 500;
      color: #333;
      border-radius: 3px;

      &:hover {
        background-color: #1976d2;
        color: white;
        border-color: #0d47a1;
      }

      &.selected {
        background-color: #1976d2;
        color: white;
        border-color: #0d47a1;
        box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.2);
      }
    }
  `]
})
export class LineHeightToolbarComponent {
    @Output() commandExecuted = new EventEmitter<void>();

    lineHeights: string[] = ['1.0', '1.2', '1.5', '1.8', '2.0', '2.5', '3.0'];
    lineHeight = new FormControl('1.5');
    showLineHeightGridFlag = false;

    private readonly OVERLAY_HIDE_DELAY = 200;
    private readonly BLOCK_ELEMENTS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'LI'];
    private lineHeightGridTimeout: ReturnType<typeof setTimeout> | undefined;

    constructor(private selectionManager: SelectionManagerService) { }

    showLineHeightGrid(): void {
        this.selectionManager.saveSelection();
        this.clearTimeout();
        this.showLineHeightGridFlag = true;
    }

    hideLineHeightGrid(): void {
        this.clearTimeout();

        this.lineHeightGridTimeout = setTimeout(() => {
            this.showLineHeightGridFlag = false;
            this.lineHeightGridTimeout = undefined;
        }, this.OVERLAY_HIDE_DELAY);
    }

    keepLineHeightGridVisible(): void {
        this.clearTimeout();
    }

    selectLineHeight(height: string): void {
        const currentValue = this.getCurrentLineHeightValue();

        if (currentValue === height) {
            this.removeLineHeightStyle();
        } else {
            this.applyLineHeight(height);
        }

        this.showLineHeightGridFlag = false;
        this.clearTimeout();
    }

    updateState(): void {
        const currentValue = this.getCurrentLineHeightValue();
        this.lineHeight.setValue(currentValue || '1.5', { emitEvent: false });
    }

    private applyLineHeight(height: string): void {
        if (this.selectionManager.isSelectionValid()) {
            this.selectionManager.restoreSelection();
        }

        const editorElement = this.selectionManager.getEditorElement();
        if (editorElement) {
            editorElement.focus();
        }

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (range.collapsed) {
            let node: Node | null = range.startContainer;
            while (node && node !== editorElement) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;
                    if (this.BLOCK_ELEMENTS.includes(element.tagName)) {
                        element.style.lineHeight = height;
                        this.lineHeight.setValue(height, { emitEvent: false });
                        this.commandExecuted.emit();
                        return;
                    }
                }
                node = node.parentElement;
            }

            const div = document.createElement('div');
            div.style.lineHeight = height;
            range.insertNode(div);
            range.selectNodeContents(div);
            selection.removeAllRanges();
            selection.addRange(range);

            this.lineHeight.setValue(height, { emitEvent: false });
            this.commandExecuted.emit();
            return;
        }

        const elements = this.getBlockElementsInRange(range);

        if (elements.length > 0) {
            elements.forEach(element => {
                element.style.lineHeight = height;
            });
        } else {
            const div = document.createElement('div');
            div.style.lineHeight = height;

            try {
                range.surroundContents(div);
            } catch (e) {
                const fragment = range.extractContents();
                div.appendChild(fragment);
                range.insertNode(div);
            }
        }

        this.lineHeight.setValue(height, { emitEvent: false });
        this.commandExecuted.emit();

        this.selectionManager.restoreSelection(range);
        editorElement?.focus();
    }

    private removeLineHeightStyle(): void {
        if (this.selectionManager.isSelectionValid()) {
            this.selectionManager.restoreSelection();
        }

        const editorElement = this.selectionManager.getEditorElement();
        if (editorElement) {
            editorElement.focus();
        }

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        const elements = this.getBlockElementsInRange(range);

        elements.forEach(element => {
            if (element.style.lineHeight) {
                element.style.lineHeight = '';

                if (!element.getAttribute('style')?.trim()) {
                    element.removeAttribute('style');
                }
            }
        });

        this.lineHeight.setValue('1.5', { emitEvent: false });
        this.commandExecuted.emit();

        this.selectionManager.restoreSelection(range);
        editorElement?.focus();
    }

    private getBlockElementsInRange(range: Range): HTMLElement[] {
        const editorElement = this.selectionManager.getEditorElement();
        let node: Node | null = range.commonAncestorContainer;

        if (node?.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        if (node === editorElement) {
            const selector = this.BLOCK_ELEMENTS.join(',');
            const allBlocks = editorElement!.querySelectorAll(selector);

            const selectedBlocks: HTMLElement[] = [];
            allBlocks.forEach((block: Element) => {
                const blockRange = document.createRange();
                try {
                    blockRange.selectNodeContents(block);

                    if (this.rangesIntersect(range, blockRange)) {
                        selectedBlocks.push(block as HTMLElement);
                    }
                } catch (error) {
                    // Range intersection check failed
                }
            });

            return selectedBlocks;
        }

        const elements: HTMLElement[] = [];
        let currentNode = node;

        while (currentNode && currentNode !== editorElement) {
            if (currentNode.nodeType === Node.ELEMENT_NODE) {
                const element = currentNode as HTMLElement;
                if (this.BLOCK_ELEMENTS.includes(element.tagName)) {
                    elements.push(element);
                    break;
                }
            }
            currentNode = currentNode.parentElement;
        }

        if (elements.length === 0 && node) {
            let parentNode = node.parentElement;
            while (parentNode && parentNode !== editorElement) {
                if (this.BLOCK_ELEMENTS.includes(parentNode.tagName)) {
                    elements.push(parentNode);
                    break;
                }
                parentNode = parentNode.parentElement;
            }
        }

        return elements;
    }

    private rangesIntersect(range1: Range, range2: Range): boolean {
        try {
            return range1.compareBoundaryPoints(Range.END_TO_START, range2) <= 0 &&
                range1.compareBoundaryPoints(Range.START_TO_END, range2) >= 0;
        } catch (error) {
            return false;
        }
    }

    private getCurrentLineHeightValue(): string {
        const range = this.selectionManager.getSavedRange();
        if (!range) return '';

        let node: Node | null = range.commonAncestorContainer;
        const editorElement = this.selectionManager.getEditorElement();

        if (node?.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        while (node && node !== editorElement) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                const lineHeight = element.style.lineHeight;

                if (lineHeight && lineHeight !== 'normal' && lineHeight !== '') {
                    return this.normalizeLineHeight(lineHeight, element);
                }
            }
            node = node.parentElement;
        }

        return '';
    }

    private normalizeLineHeight(lineHeight: string, element: HTMLElement): string {
        if (/^[\d.]+$/.test(lineHeight)) {
            return lineHeight;
        }

        if (lineHeight.endsWith('px')) {
            try {
                const computedStyle = window.getComputedStyle(element);
                const fontSize = parseFloat(computedStyle.fontSize);
                const lineHeightPx = parseFloat(lineHeight);

                if (fontSize > 0 && !isNaN(lineHeightPx)) {
                    const relative = (lineHeightPx / fontSize).toFixed(1);
                    const match = this.lineHeights.find(h =>
                        Math.abs(parseFloat(h) - parseFloat(relative)) < 0.1
                    );
                    return match || relative;
                }
            } catch (error) {
                // Normalization failed
            }
        }

        return lineHeight;
    }

    private clearTimeout(): void {
        if (this.lineHeightGridTimeout !== undefined) {
            clearTimeout(this.lineHeightGridTimeout);
            this.lineHeightGridTimeout = undefined;
        }
    }
}