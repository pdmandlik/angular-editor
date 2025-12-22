import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { ICE_CLASSES, BLOCK_ELEMENTS, BLOCK_OR_BREAK_ELEMENTS, DELETE_STYLES, INSERT_STYLES } from './track-changes.constants';
import { EditorOutputMode } from '../../entities/editor-config';

/**
 * DOM utilities for track changes: cursor positioning, content output,
 * block element handling, and selection utilities.
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesDomService {
    constructor(private stateService: TrackChangesStateService) { }

    // ============================================================================
    // CURSOR POSITIONING
    // ============================================================================

    /**
     * Position cursor at the start of a block element
     */
    positionCursorAtBlockStart(block: HTMLElement, selection: Selection): void {
        const editorEl = this.stateService.getEditorElement();
        editorEl?.focus();

        const newRange = document.createRange();
        const firstChild = block.firstChild;

        if (!firstChild) {
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        } else if (firstChild.nodeType === Node.TEXT_NODE) {
            newRange.setStart(firstChild, 0);
            newRange.setEnd(firstChild, 0);
        } else if (firstChild.nodeType === Node.ELEMENT_NODE) {
            const firstElement = firstChild as HTMLElement;

            if (firstElement.tagName === 'BR') {
                newRange.setStartBefore(firstElement);
                newRange.setEndBefore(firstElement);
            } else if (firstElement.classList.contains(ICE_CLASSES.insert) ||
                firstElement.classList.contains(ICE_CLASSES.delete)) {
                const textNode = this.findFirstTextNodeIn(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else {
                    newRange.setStart(firstElement, 0);
                    newRange.setEnd(firstElement, 0);
                }
            } else {
                const textNode = this.findFirstTextNodeIn(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else {
                    newRange.setStart(block, 0);
                    newRange.setEnd(block, 0);
                }
            }
        } else {
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        }

        selection.removeAllRanges();
        selection.addRange(newRange);

        // Verify cursor position after browser processing
        this.verifyCursorPosition(block);
    }

    /**
     * Verify and fix cursor position if needed
     */
    private verifyCursorPosition(targetBlock: HTMLElement): void {
        setTimeout(() => {
            const currentSel = window.getSelection();
            if (!currentSel || currentSel.rangeCount === 0) return;

            const currentRange = currentSel.getRangeAt(0);
            if (!targetBlock.contains(currentRange.startContainer) &&
                !targetBlock.contains(currentRange.startContainer.parentNode)) {
                // Cursor escaped - force it back
                const fixRange = document.createRange();
                if (targetBlock.firstChild) {
                    if (targetBlock.firstChild.nodeType === Node.TEXT_NODE) {
                        fixRange.setStart(targetBlock.firstChild, 0);
                    } else {
                        fixRange.setStartBefore(targetBlock.firstChild);
                    }
                } else {
                    fixRange.setStart(targetBlock, 0);
                }
                fixRange.collapse(true);
                currentSel.removeAllRanges();
                currentSel.addRange(fixRange);
            }
        }, 0);
    }

    /**
     * Find first text node within an element
     */
    findFirstTextNodeIn(element: HTMLElement): Text | null {
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE) {
                return child as Text;
            }
            if (child.nodeType === Node.ELEMENT_NODE) {
                const found = this.findFirstTextNodeIn(child as HTMLElement);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Get offset position within a node
     */
    getOffsetInNode(range: Range, targetNode: Node): number {
        if (range.startContainer === targetNode) {
            return range.startOffset;
        }

        if (targetNode.nodeType === Node.ELEMENT_NODE) {
            const element = targetNode as HTMLElement;
            let offset = 0;
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null
            );
            let currentNode: Node | null;

            while ((currentNode = walker.nextNode())) {
                if (currentNode === range.startContainer) {
                    return offset + range.startOffset;
                }
                offset += currentNode.textContent?.length || 0;
            }
        }

        return range.startOffset;
    }

    // ============================================================================
    // BLOCK ELEMENT HANDLING
    // ============================================================================

    /**
     * Find closest block-level ancestor element
     */
    findClosestBlockElement(node: Node): HTMLElement | null {
        const editorEl = this.stateService.getEditorElement();
        let current: Node | null = node;

        while (current && current !== editorEl) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const element = current as HTMLElement;
                if (BLOCK_ELEMENTS.includes(element.tagName as any)) {
                    return element;
                }
            }
            current = current.parentNode;
        }

        return null;
    }

    /**
     * Check if an element is a block or break element
     */
    isBlockOrBreakElement(element: HTMLElement): boolean {
        return BLOCK_OR_BREAK_ELEMENTS.includes(element.tagName.toUpperCase() as any);
    }

    // ============================================================================
    // CONTENT CHECKING
    // ============================================================================

    /**
     * Check if a DocumentFragment has visible content
     */
    fragmentHasVisibleContent(fragment: DocumentFragment): boolean {
        if (fragment.textContent?.trim()) return true;

        const significantElements = fragment.querySelectorAll(
            'img, table, hr, iframe, video, audio'
        );
        return significantElements.length > 0;
    }

    /**
     * Check if an element has visible content
     */
    elementHasVisibleContent(element: HTMLElement): boolean {
        if (element.textContent?.trim()) return true;

        const significantElements = element.querySelectorAll(
            'img, table, hr, iframe, video, audio'
        );
        return significantElements.length > 0;
    }

    // ============================================================================
    // CONTENT OUTPUT
    // ============================================================================

    /**
     * Get content from editor in specified mode
     */
    getContent(element: HTMLElement, mode: EditorOutputMode): string {
        if (mode === EditorOutputMode.Clean) {
            return this.getCleanContent(element);
        }
        return element.innerHTML;
    }

    /**
     * Get clean content without track changes markup
     */
    private getCleanContent(element: HTMLElement): string {
        const clone = element.cloneNode(true) as HTMLElement;

        // Remove delete nodes entirely
        const deleteNodes = clone.querySelectorAll(`.${ICE_CLASSES.delete}`);
        deleteNodes.forEach(node => node.parentNode?.removeChild(node));

        // Unwrap insert nodes (keep content, remove wrapper)
        const insertNodes = clone.querySelectorAll(`.${ICE_CLASSES.insert}`);
        insertNodes.forEach(node => {
            const parent = node.parentNode;
            if (parent) {
                while (node.firstChild) {
                    parent.insertBefore(node.firstChild, node);
                }
                parent.removeChild(node);
            }
        });

        return clone.innerHTML;
    }

    // ============================================================================
    // WORD BOUNDARY UTILITIES
    // ============================================================================

    /**
     * Get word length before cursor position
     */
    getWordLengthBefore(text: string, offset: number): number {
        let length = 0;
        let pos = offset - 1;

        // Skip any trailing whitespace
        while (pos >= 0 && /\s/.test(text[pos])) {
            length++;
            pos--;
        }

        // Get the word characters
        while (pos >= 0 && !/\s/.test(text[pos])) {
            length++;
            pos--;
        }

        return Math.max(1, length);
    }

    /**
     * Get word length after cursor position
     */
    getWordLengthAfter(text: string, offset: number): number {
        let length = 0;
        let pos = offset;

        // Get the word characters
        while (pos < text.length && !/\s/.test(text[pos])) {
            length++;
            pos++;
        }

        // Include trailing whitespace
        while (pos < text.length && /\s/.test(text[pos])) {
            length++;
            pos++;
        }

        return Math.max(1, length);
    }

    // ============================================================================
    // VISIBILITY TOGGLE
    // ============================================================================

    /**
    * Toggle visibility of track change nodes
    * 
    * When hiding changes:
    * - DELETE nodes: hidden completely (display: none)
    * - INSERT nodes: content remains visible but highlighting is removed
    * 
    * When showing changes:
    * - DELETE nodes: shown with strikethrough styling
    * - INSERT nodes: shown with green highlight styling
    */
    toggleNodesVisibility(visible: boolean): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        const iceNodes = editorEl.querySelectorAll(
            `.${ICE_CLASSES.insert}, .${ICE_CLASSES.delete}`
        );

        iceNodes.forEach((node: Element) => {
            const element = node as HTMLElement;

            if (element.classList.contains(ICE_CLASSES.delete)) {
                // DELETE nodes: toggle display
                if (visible) {
                    // Show with delete styling
                    element.style.removeProperty('display');
                    element.style.backgroundColor = DELETE_STYLES.backgroundColor;
                    element.style.textDecoration = DELETE_STYLES.textDecoration;
                    element.style.color = DELETE_STYLES.color;
                } else {
                    // Hide completely
                    element.style.display = 'none';
                }
            } else if (element.classList.contains(ICE_CLASSES.insert)) {
                // INSERT nodes: toggle highlighting (content always visible)
                if (visible) {
                    // Show with insert styling (green highlight)
                    element.style.backgroundColor = INSERT_STYLES.backgroundColor;
                    element.style.textDecoration = INSERT_STYLES.textDecoration;
                } else {
                    // Hide highlighting but keep content visible
                    element.style.backgroundColor = 'transparent';
                    element.style.textDecoration = 'none';
                }
            }
        });
    }

    // ============================================================================
    // SELECTION UTILITIES
    // ============================================================================

    /**
     * Get current selection range
     */
    getCurrentRange(): Range | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        return selection.getRangeAt(0);
    }

    /**
     * Set selection to a range
     */
    setSelectionRange(range: Range): void {
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Position cursor after a node
     */
    positionCursorAfter(node: Node): void {
        const range = document.createRange();
        range.setStartAfter(node);
        range.setEndAfter(node);
        this.setSelectionRange(range);
    }

    /**
     * Position cursor before a node
     */
    positionCursorBefore(node: Node): void {
        const range = document.createRange();
        range.setStartBefore(node);
        range.setEndBefore(node);
        this.setSelectionRange(range);
    }
}