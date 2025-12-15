import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { TrackChangesNodeService } from './track-changes-node.service';
import { TrackChangesDomService } from './track-changes-dom.service';
import { IceNode, CHANGE_TYPES, ICE_ATTRIBUTES, ICE_CLASSES, BLOCK_ELEMENTS } from './track-changes.constants';
import { ChangeRecord } from '../../entities/editor-config';

/**
 * Handles all delete operations with track changes.
 * Creates tracked deletions for backspace, delete, and selection deletion.
 * 
 * KEY BEHAVIOR (matching CKEditor LITE plugin):
 * - Content inside current user's INSERT nodes: Remove directly (no tracking)
 * - Original/untracked content: Wrap in DELETE node (strikethrough)
 * - Content inside OTHER user's INSERT nodes: Wrap in DELETE node
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesDeleteService {
    constructor(
        private stateService: TrackChangesStateService,
        private nodeService: TrackChangesNodeService,
        private domService: TrackChangesDomService
    ) { }

    /**
     * Main delete method - entry point for all deletions
     */
    deleteContents(isForward: boolean, isWord: boolean = false): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        if (!range.collapsed) {
            this.deleteSelection(range);
        } else {
            if (isForward) {
                this.deleteRight(range, isWord);
            } else {
                this.deleteLeft(range, isWord);
            }
        }
    }

    /**
     * Delete selected content - FIXED VERSION
     * 
     * This method now properly handles mixed content:
     * - Untracked original content -> wrapped in delete node
     * - Current user's inserts -> removed entirely
     * - Other user's inserts -> wrapped in delete node
     */
    deleteSelection(range: Range): void {
        if (range.collapsed) return;

        const changeId = this.stateService.startBatchChange() ||
            this.stateService.getBatchChangeId() ||
            this.stateService.getNewChangeId();

        // Create bookmarks to mark selection boundaries
        const bookmark = this.createBookmark(range);

        // Get all elements between bookmarks
        const elements = this.getElementsBetween(bookmark.start, bookmark.end);

        const deleteNodes: HTMLElement[] = [];

        // Process each element individually (like ICE.js does)
        for (let i = 0; i < elements.length; i++) {
            const elem = elements[i];

            // Skip if element was removed as side effect
            if (!elem || !elem.parentNode) continue;

            // Skip bookmark elements
            if (this.isBookmarkNode(elem)) continue;

            // Handle block elements - process children instead
            if (this.isBlockElement(elem)) {
                // Add children to processing queue
                for (let k = 0; k < elem.childNodes.length; k++) {
                    elements.push(elem.childNodes[k] as Element);
                }
                continue;
            }

            // Skip empty text nodes
            if (this.isEmptyTextNode(elem)) {
                elem.parentNode?.removeChild(elem);
                continue;
            }

            // Process text nodes and other elements
            if (elem.nodeType === Node.TEXT_NODE) {
                this.processTextNodeForDeletion(elem as unknown as Text, changeId, deleteNodes);
            } else if (elem.nodeType === Node.ELEMENT_NODE) {
                this.processElementForDeletion(elem as HTMLElement, changeId, deleteNodes, elements);
            }
        }

        // Clean up bookmarks and position cursor
        this.removeBookmarks(bookmark);

        if (deleteNodes.length > 0) {
            // Merge adjacent delete nodes
            this.mergeAdjacentDeleteNodes(deleteNodes);

            // Position cursor before first delete node
            const newRange = document.createRange();
            newRange.setStartBefore(deleteNodes[0]);
            newRange.collapse(true);

            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }

        this.stateService.notifyContentChange();
    }

    /**
     * Process a text node for deletion
     */
    private processTextNodeForDeletion(
        textNode: Text,
        changeId: string,
        deleteNodes: HTMLElement[]
    ): void {
        const parent = textNode.parentNode;
        if (!parent) return;

        // Check if this text node is inside a current user's INSERT node
        const insertNode = this.nodeService.getIceNode(textNode, CHANGE_TYPES.INSERT);

        if (insertNode && this.nodeService.isCurrentUserIceNode(insertNode)) {
            // CURRENT USER'S INSERT: Remove the text directly (no tracking)
            textNode.parentNode?.removeChild(textNode);

            // If the insert node is now empty, remove it too
            if (insertNode.parentNode && !insertNode.textContent && !insertNode.querySelector('br')) {
                insertNode.parentNode.removeChild(insertNode);
            }
            return;
        }

        // Check if inside a DELETE node already
        const deleteNode = this.nodeService.getIceNode(textNode, CHANGE_TYPES.DELETE);
        if (deleteNode) {
            // Already deleted - skip (just move cursor)
            return;
        }

        // ORIGINAL/UNTRACKED CONTENT or OTHER USER'S INSERT: Wrap in delete node
        const delNode = this.nodeService.createIceNode(CHANGE_TYPES.DELETE, changeId);

        // Insert delete node before text node
        parent.insertBefore(delNode, textNode);
        // Move text node into delete node
        delNode.appendChild(textNode);

        deleteNodes.push(delNode);
        this.addChangeRecord(changeId, [delNode], 'delete');
    }

    /**
     * Process an element for deletion
     */
    private processElementForDeletion(
        elem: HTMLElement,
        changeId: string,
        deleteNodes: HTMLElement[],
        elementsQueue: Element[]
    ): void {
        // Handle BR elements
        if (elem.tagName === 'BR') {
            this.processBreakForDeletion(elem, changeId, deleteNodes);
            return;
        }

        // Check if it's a current user's INSERT node
        if (elem.classList.contains(ICE_CLASSES.insert) &&
            this.nodeService.isCurrentUserIceNode(elem as IceNode)) {
            // Remove the entire insert node and its contents
            elem.parentNode?.removeChild(elem);
            return;
        }

        // Check if it's a DELETE node
        if (elem.classList.contains(ICE_CLASSES.delete)) {
            // Already deleted - skip
            return;
        }

        // Check if inside a current user's INSERT node
        const insertNode = this.nodeService.getIceNode(elem, CHANGE_TYPES.INSERT);
        if (insertNode && this.nodeService.isCurrentUserIceNode(insertNode)) {
            // Remove element (it's inside current user's insert)
            elem.parentNode?.removeChild(elem);

            // If insert node is now empty, remove it
            if (insertNode.parentNode && !insertNode.textContent && !insertNode.querySelector('br')) {
                insertNode.parentNode.removeChild(insertNode);
            }
            return;
        }

        // If element has children, process them instead
        if (elem.childNodes.length > 0 && !this.isStubElement(elem)) {
            for (let j = 0; j < elem.childNodes.length; j++) {
                elementsQueue.push(elem.childNodes[j] as Element);
            }
            return;
        }

        // Stub elements (img, hr, etc.) or empty elements: wrap in delete
        if (this.isStubElement(elem) || !elem.childNodes.length) {
            const delNode = this.nodeService.createIceNode(CHANGE_TYPES.DELETE, changeId);
            elem.parentNode?.insertBefore(delNode, elem);
            delNode.appendChild(elem);
            deleteNodes.push(delNode);
            this.addChangeRecord(changeId, [delNode], 'delete');
        }
    }

    /**
     * Process BR element for deletion
     */
    private processBreakForDeletion(
        br: HTMLElement,
        changeId: string,
        deleteNodes: HTMLElement[]
    ): void {
        // Check if BR is inside current user's insert
        const insertNode = this.nodeService.getIceNode(br, CHANGE_TYPES.INSERT);
        if (insertNode && this.nodeService.isCurrentUserIceNode(insertNode)) {
            br.parentNode?.removeChild(br);
            if (insertNode.parentNode && !insertNode.textContent && !insertNode.querySelector('br')) {
                insertNode.parentNode.removeChild(insertNode);
            }
            return;
        }

        // Check if already in a delete node
        const deleteNode = this.nodeService.getIceNode(br, CHANGE_TYPES.DELETE);
        if (deleteNode) {
            return; // Already deleted
        }

        // Wrap BR in delete node
        const delNode = this.nodeService.createIceNode(CHANGE_TYPES.DELETE, changeId);
        br.parentNode?.insertBefore(delNode, br);
        delNode.appendChild(br);
        deleteNodes.push(delNode);
        this.addChangeRecord(changeId, [delNode], 'delete');
    }

    /**
     * Create bookmark spans to mark selection boundaries
     */
    private createBookmark(range: Range): { start: HTMLElement; end: HTMLElement } {
        const doc = document;

        // Clone range to avoid modifying original
        const clonedRange = range.cloneRange();

        // Create end bookmark first (to not affect start position)
        clonedRange.collapse(false);
        const endBookmark = doc.createElement('span');
        endBookmark.className = 'iceBookmark iceBookmark_end';
        endBookmark.style.display = 'none';
        endBookmark.innerHTML = '&nbsp;';
        clonedRange.insertNode(endBookmark);

        // Create start bookmark
        clonedRange.setStart(range.startContainer, range.startOffset);
        clonedRange.collapse(true);
        const startBookmark = doc.createElement('span');
        startBookmark.className = 'iceBookmark iceBookmark_start';
        startBookmark.style.display = 'none';
        startBookmark.innerHTML = '&nbsp;';
        clonedRange.insertNode(startBookmark);

        return { start: startBookmark, end: endBookmark };
    }

    /**
     * Remove bookmark elements
     */
    private removeBookmarks(bookmark: { start: HTMLElement; end: HTMLElement }): void {
        bookmark.start.parentNode?.removeChild(bookmark.start);
        bookmark.end.parentNode?.removeChild(bookmark.end);
    }

    /**
     * Check if node is a bookmark
     */
    private isBookmarkNode(node: Node): boolean {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        return (node as HTMLElement).classList.contains('iceBookmark');
    }

    /**
     * Get all elements between two bookmark nodes
     */
    private getElementsBetween(start: Node, end: Node): Element[] {
        const elements: Element[] = [];
        let current: Node | null = start.nextSibling;

        while (current && current !== end) {
            if (current.nodeType === Node.TEXT_NODE ||
                current.nodeType === Node.ELEMENT_NODE) {
                elements.push(current as Element);
            }

            // Move to next node using tree walker logic
            if (current.firstChild && current.nodeType === Node.ELEMENT_NODE &&
                !(current as HTMLElement).classList.contains('iceBookmark')) {
                current = current.firstChild;
            } else if (current.nextSibling) {
                current = current.nextSibling;
            } else {
                // Go up and find next sibling
                let parent = current.parentNode;
                current = null;
                while (parent && parent !== end.parentNode) {
                    if (parent.nextSibling) {
                        current = parent.nextSibling;
                        break;
                    }
                    parent = parent.parentNode;
                }
            }
        }

        return elements;
    }

    /**
     * Check if a text node is empty (only whitespace)
     */
    private isEmptyTextNode(node: Node): boolean {
        if (node.nodeType !== Node.TEXT_NODE) return false;
        const text = node.textContent || '';
        return text.replace(/[\u200B\uFEFF]/g, '').trim() === '';
    }

    /**
     * Check if element is a stub element (img, br, hr, etc.)
     */
    private isStubElement(elem: HTMLElement): boolean {
        const stubElements = ['IMG', 'HR', 'IFRAME', 'PARAM', 'LINK', 'META', 'INPUT', 'FRAME', 'COL', 'BASE', 'AREA', 'BR'];
        return stubElements.includes(elem.tagName);
    }

    /**
     * Merge adjacent delete nodes that belong to the same change
     */
    private mergeAdjacentDeleteNodes(deleteNodes: HTMLElement[]): void {
        if (deleteNodes.length < 2) return;

        for (let i = 0; i < deleteNodes.length - 1; i++) {
            const current = deleteNodes[i];
            const next = deleteNodes[i + 1];

            // Check if they're adjacent and belong to same user
            if (current.nextSibling === next &&
                this.nodeService.isCurrentUserIceNode(current as IceNode) &&
                this.nodeService.isCurrentUserIceNode(next as IceNode)) {

                // Move contents of next into current
                while (next.firstChild) {
                    current.appendChild(next.firstChild);
                }
                next.parentNode?.removeChild(next);

                // Remove from array and adjust index
                deleteNodes.splice(i + 1, 1);
                i--;
            }
        }
    }

    /**
     * Add a change record
     */
    private addChangeRecord(changeId: string, nodes: HTMLElement[], type: 'insert' | 'delete'): void {
        const user = this.stateService.getCurrentUser();
        const record: ChangeRecord = {
            id: changeId,
            type,
            userId: user.id,
            userName: user.name,
            timestamp: new Date(),
            content: nodes.map(n => n.textContent || '').join('')
        };
        this.stateService.addChange(record);
    }

    // ============================================================================
    // SINGLE CHARACTER DELETE METHODS (unchanged from original)
    // ============================================================================

    /**
     * Delete left (backspace)
     */
    private deleteLeft(range: Range, isWord: boolean = false): void {
        const container = range.startContainer;
        const offset = range.startOffset;

        if (container.nodeType === Node.TEXT_NODE && offset === 0) {
            this.deleteAtBoundary(range, true);
            return;
        }

        if (container.nodeType === Node.ELEMENT_NODE && offset === 0) {
            this.deleteAtBoundary(range, true);
            return;
        }

        if (container.nodeType === Node.TEXT_NODE) {
            const textNode = container as Text;
            const text = textNode.textContent || '';

            const insertNode = this.nodeService.getCurrentUserIceNode(textNode, CHANGE_TYPES.INSERT);
            if (insertNode) {
                const length = isWord ? this.domService.getWordLengthBefore(text, offset) : 1;
                textNode.textContent = text.substring(0, offset - length) + text.substring(offset);

                range.setStart(textNode, offset - length);
                range.setEnd(textNode, offset - length);

                if (!insertNode.textContent) {
                    insertNode.parentNode?.removeChild(insertNode);
                }

                this.domService.setSelectionRange(range);
                this.stateService.notifyContentChange();
                return;
            }

            const length = isWord ? this.domService.getWordLengthBefore(text, offset) : 1;
            this.createDeleteForTextNode(textNode, offset, length, true);
        }
    }

    /**
     * Delete right (delete key)
     */
    private deleteRight(range: Range, isWord: boolean = false): void {
        const container = range.startContainer;
        const offset = range.startOffset;

        if (container.nodeType === Node.TEXT_NODE) {
            const textNode = container as Text;
            const text = textNode.textContent || '';

            if (offset >= text.length) {
                this.deleteAtBoundary(range, false);
                return;
            }

            const insertNode = this.nodeService.getCurrentUserIceNode(textNode, CHANGE_TYPES.INSERT);
            if (insertNode) {
                const length = isWord ? this.domService.getWordLengthAfter(text, offset) : 1;
                textNode.textContent = text.substring(0, offset) + text.substring(offset + length);

                if (!insertNode.textContent) {
                    insertNode.parentNode?.removeChild(insertNode);
                }

                this.domService.setSelectionRange(range);
                this.stateService.notifyContentChange();
                return;
            }

            const length = isWord ? this.domService.getWordLengthAfter(text, offset) : 1;
            this.createDeleteForTextNode(textNode, offset, length, false);
            return;
        }

        if (container.nodeType === Node.ELEMENT_NODE) {
            const element = container as HTMLElement;
            if (offset >= element.childNodes.length) {
                this.deleteAtBoundary(range, false);
                return;
            }

            const nextChild = element.childNodes[offset];
            if (nextChild) {
                this.deleteNode(nextChild, range);
            }
        }
    }

    /**
     * Delete at a boundary (between nodes or at edges)
     */
    private deleteAtBoundary(range: Range, isBackspace: boolean): void {
        const container = range.startContainer;
        const targetNode = isBackspace
            ? this.getPreviousNode(container)
            : this.getNextNode(container);

        if (!targetNode) return;

        this.deleteNode(targetNode, range);
    }

    /**
     * Delete a specific node
     */
    private deleteNode(node: Node, range: Range): void {
        const changeId = this.stateService.startBatchChange() ||
            this.stateService.getBatchChangeId() ||
            this.stateService.getNewChangeId();

        if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            if (textNode.textContent) {
                this.createDeleteForTextNode(textNode, 0, 1, false);
            }
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            if (element.classList.contains(ICE_CLASSES.insert) &&
                this.nodeService.isCurrentUserIceNode(element as IceNode)) {
                element.parentNode?.removeChild(element);
                this.domService.setSelectionRange(range);
                this.stateService.notifyContentChange();
                return;
            }
        }

        const deleteNode = this.nodeService.createIceNode(CHANGE_TYPES.DELETE, changeId);
        node.parentNode?.insertBefore(deleteNode, node);
        deleteNode.appendChild(node);

        range.setStartAfter(deleteNode);
        range.setEndAfter(deleteNode);

        this.domService.setSelectionRange(range);
        this.addChangeRecord(changeId, [deleteNode], 'delete');
        this.stateService.notifyContentChange();
    }

    /**
     * Create delete tracking for text within a text node
     */
    private createDeleteForTextNode(
        textNode: Text,
        offset: number,
        length: number,
        moveLeft: boolean
    ): void {
        const text = textNode.textContent || '';
        const parent = textNode.parentNode;
        if (!parent) return;

        const changeId = this.stateService.startBatchChange() ||
            this.stateService.getBatchChangeId() ||
            this.stateService.getNewChangeId();

        let beforeText: string;
        let deletedText: string;
        let afterText: string;

        if (moveLeft) {
            beforeText = text.substring(0, offset - length);
            deletedText = text.substring(offset - length, offset);
            afterText = text.substring(offset);
        } else {
            beforeText = text.substring(0, offset);
            deletedText = text.substring(offset, offset + length);
            afterText = text.substring(offset + length);
        }

        const adjacentDeleteNode = this.nodeService.getAdjacentDeleteNode(textNode, moveLeft);
        const range = document.createRange();

        if (adjacentDeleteNode) {
            this.nodeService.updateChangeTime(
                adjacentDeleteNode.getAttribute(ICE_ATTRIBUTES.changeId) || ''
            );

            textNode.textContent = beforeText + afterText;

            const deleteTextNode = document.createTextNode(deletedText);
            if (moveLeft) {
                adjacentDeleteNode.insertBefore(deleteTextNode, adjacentDeleteNode.firstChild);
            } else {
                adjacentDeleteNode.appendChild(deleteTextNode);
            }

            if (beforeText) {
                range.setStart(textNode, beforeText.length);
                range.setEnd(textNode, beforeText.length);
            } else {
                range.setStartBefore(adjacentDeleteNode);
                range.setEndBefore(adjacentDeleteNode);
            }
        } else {
            const fragment = document.createDocumentFragment();

            let beforeNode: Text | null = null;
            if (beforeText) {
                beforeNode = document.createTextNode(beforeText);
                fragment.appendChild(beforeNode);
            }

            const deleteNode = this.nodeService.createIceNode(CHANGE_TYPES.DELETE, changeId);
            deleteNode.appendChild(document.createTextNode(deletedText));
            fragment.appendChild(deleteNode);
            this.addChangeRecord(changeId, [deleteNode], 'delete');

            if (afterText) {
                fragment.appendChild(document.createTextNode(afterText));
            }

            parent.replaceChild(fragment, textNode);

            if (beforeNode) {
                range.setStart(beforeNode, beforeNode.length);
                range.setEnd(beforeNode, beforeNode.length);
            } else {
                range.setStartBefore(deleteNode);
                range.setEndBefore(deleteNode);
            }
        }

        this.domService.setSelectionRange(range);
        this.stateService.notifyContentChange();
    }

    /**
     * Get previous node for deletion
     */
    private getPreviousNode(container: Node): Node | null {
        if (container.nodeType === Node.TEXT_NODE) {
            return container.previousSibling || container.parentNode?.previousSibling || null;
        }
        return container.previousSibling || null;
    }

    /**
     * Get next node for deletion
     */
    private getNextNode(container: Node): Node | null {
        if (container.nodeType === Node.TEXT_NODE) {
            return container.nextSibling || container.parentNode?.nextSibling || null;
        }
        return container.nextSibling || null;
    }

    /**
     * Check if node is a block element
     */
    private isBlockElement(node: Node): boolean {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const element = node as HTMLElement;
        return BLOCK_ELEMENTS.includes(element.tagName.toUpperCase() as any);
    }
}