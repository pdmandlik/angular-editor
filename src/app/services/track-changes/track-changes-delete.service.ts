import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { TrackChangesNodeService } from './track-changes-node.service';
import { TrackChangesDomService } from './track-changes-dom.service';
import { IceNode, CHANGE_TYPES, ICE_ATTRIBUTES, ICE_CLASSES } from './track-changes.constants';
import { ChangeRecord } from '../../entities/editor-config';

/**
 * Handles all delete operations with track changes.
 * Creates tracked deletions for backspace, delete, and selection deletion.
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
     * Delete selected content
     */
    deleteSelection(range: Range): void {
        if (range.collapsed) return;

        const changeId = this.stateService.startBatchChange() ||
            this.stateService.getBatchChangeId() ||
            this.stateService.getNewChangeId();

        const commonAncestor = range.commonAncestorContainer;
        const insertNode = this.nodeService.getCurrentUserIceNode(
            commonAncestor,
            CHANGE_TYPES.INSERT
        );

        // If inside current user's insert node, just delete the content
        if (insertNode && this.nodeService.isCurrentUserIceNode(insertNode)) {
            range.deleteContents();

            if (!insertNode.textContent && !insertNode.querySelector('br')) {
                insertNode.parentNode?.removeChild(insertNode);
            }

            this.stateService.notifyContentChange();
            return;
        }

        // Extract contents to mark as deleted
        const contents = range.extractContents();

        // Remove empty insert nodes from extracted content
        const emptyInserts = contents.querySelectorAll(`.${ICE_CLASSES.insert}:empty`);
        emptyInserts.forEach(node => node.parentNode?.removeChild(node));

        // Create delete node
        const deleteNode = this.nodeService.createIceNode(CHANGE_TYPES.DELETE, changeId);
        deleteNode.appendChild(contents);

        range.insertNode(deleteNode);

        // Position cursor after delete node
        range.setStartAfter(deleteNode);
        range.setEndAfter(deleteNode);

        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }

        this.addChangeRecord(changeId, [deleteNode], 'delete');
        this.stateService.notifyContentChange();
    }

    /**
     * Delete left (backspace)
     */
    private deleteLeft(range: Range, isWord: boolean = false): void {
        const container = range.startContainer;
        const offset = range.startOffset;

        // At beginning of text node
        if (container.nodeType === Node.TEXT_NODE && offset === 0) {
            this.deleteAtBoundary(range, true);
            return;
        }

        // At beginning of element
        if (container.nodeType === Node.ELEMENT_NODE && offset === 0) {
            this.deleteAtBoundary(range, true);
            return;
        }

        // Inside text node
        if (container.nodeType === Node.TEXT_NODE) {
            const textNode = container as Text;
            const text = textNode.textContent || '';

            // Check if inside current user's insert node
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

            // Create delete tracking
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

        // At end of text node
        if (container.nodeType === Node.TEXT_NODE) {
            const textNode = container as Text;
            const text = textNode.textContent || '';

            if (offset >= text.length) {
                this.deleteAtBoundary(range, false);
                return;
            }

            // Check if inside current user's insert node
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

            // Create delete tracking
            const length = isWord ? this.domService.getWordLengthAfter(text, offset) : 1;
            this.createDeleteForTextNode(textNode, offset, length, false);
            return;
        }

        // At end of element or between elements
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

        // Handle text nodes
        if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            if (textNode.textContent) {
                this.createDeleteForTextNode(textNode, 0, 1, false);
            }
            return;
        }

        // Handle element nodes
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // If it's current user's insert node, just remove it
            if (element.classList.contains(ICE_CLASSES.insert) &&
                this.nodeService.isCurrentUserIceNode(element as IceNode)) {
                element.parentNode?.removeChild(element);
                this.domService.setSelectionRange(range);
                this.stateService.notifyContentChange();
                return;
            }
        }

        // Create delete node to wrap the target
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

        // Check for adjacent delete node to merge with
        const adjacentDeleteNode = this.nodeService.getAdjacentDeleteNode(textNode, moveLeft);

        const range = document.createRange();

        if (adjacentDeleteNode) {
            // Merge with existing delete node
            this.nodeService.updateChangeTime(
                adjacentDeleteNode.getAttribute(ICE_ATTRIBUTES.changeId) || ''
            );

            textNode.textContent = beforeText + afterText;

            // Prepend/append deleted text to existing delete node
            const deleteTextNode = document.createTextNode(deletedText);
            if (moveLeft) {
                adjacentDeleteNode.insertBefore(deleteTextNode, adjacentDeleteNode.firstChild);
            } else {
                adjacentDeleteNode.appendChild(deleteTextNode);
            }

            // Position cursor
            if (beforeText) {
                range.setStart(textNode, beforeText.length);
                range.setEnd(textNode, beforeText.length);
            } else {
                range.setStartBefore(adjacentDeleteNode);
                range.setEndBefore(adjacentDeleteNode);
            }
        } else {
            // Create new delete node
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

            // Position cursor
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
     * Get previous node for boundary deletion
     */
    private getPreviousNode(node: Node): Node | null {
        if (node.previousSibling) {
            let prev = node.previousSibling;
            while (prev.lastChild) {
                prev = prev.lastChild;
            }
            return prev;
        }
        return node.parentNode?.previousSibling || null;
    }

    /**
     * Get next node for boundary deletion
     */
    private getNextNode(node: Node): Node | null {
        if (node.nextSibling) {
            let next = node.nextSibling;
            while (next.firstChild) {
                next = next.firstChild;
            }
            return next;
        }
        return node.parentNode?.nextSibling || null;
    }

    /**
     * Add change record to state
     */
    private addChangeRecord(changeId: string, nodes: IceNode[], type: 'insert' | 'delete'): void {
        const user = this.stateService.getCurrentUser();
        const record: ChangeRecord = {
            id: changeId,
            type: type,
            userId: user.id,
            userName: user.name,
            timestamp: new Date(),
            content: nodes.map(n => n.textContent || '').join(''),
            spanElement: nodes[0]
        };
        this.stateService.addChange(record);
    }
}