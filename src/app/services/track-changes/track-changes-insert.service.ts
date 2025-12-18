import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { TrackChangesNodeService } from './track-changes-node.service';
import { TrackChangesDomService } from './track-changes-dom.service';
import { IceNode, CHANGE_TYPES, ICE_ATTRIBUTES, ICE_CLASSES } from './track-changes.constants';
import { ChangeRecord } from '../../entities/editor-config';

export interface InsertOptions {
    text?: string;
    nodes?: Node[];
}

@Injectable({ providedIn: 'root' })
export class TrackChangesInsertService {
    constructor(
        private stateService: TrackChangesStateService,
        private nodeService: TrackChangesNodeService,
        private domService: TrackChangesDomService
    ) { }

    insert(options: InsertOptions, deleteCallback?: (range: Range) => void): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        let range = selection.getRangeAt(0);

        if (!range.collapsed && deleteCallback) {
            deleteCallback(range);
            range = selection.getRangeAt(0);
        }

        // CRITICAL FIX: Move cursor outside of any delete node before inserting
        // This mirrors ice.js _moveRangeToValidTrackingPos behavior
        // Delete nodes are "void" elements - we cannot insert content inside them
        this.moveRangeToValidTrackingPos(range, selection);

        const changeId = this.stateService.startBatchChange() ||
            this.stateService.getBatchChangeId() ||
            this.stateService.getNewChangeId();

        // CASE 1: Inside current user's insert node
        const currentInsertNode = this.nodeService.getCurrentUserIceNode(
            range.startContainer,
            CHANGE_TYPES.INSERT
        );

        if (currentInsertNode && this.nodeService.isCurrentUserIceNode(currentInsertNode)) {
            this.insertIntoExistingNode(currentInsertNode, range, selection, options);
            return;
        }

        // CASE 2: Adjacent to current user's insert node
        const adjacentInsertNode = this.nodeService.getAdjacentCurrentUserInsertNode(range);

        if (adjacentInsertNode) {
            this.appendToAdjacentNode(adjacentInsertNode, range, selection, options);
            return;
        }

        // CASE 3: Create new insert node
        this.createNewInsertNode(changeId, range, selection, options);
    }

    /**
     * Move range outside of delete nodes before inserting.
     * Delete nodes are "void" elements for tracking purposes - we cannot insert inside them.
     * If the cursor is inside a delete node, we need to move it outside (after) the delete node.
     * This mirrors ice.js _moveRangeToValidTrackingPos behavior.
     */
    private moveRangeToValidTrackingPos(range: Range, selection: Selection): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        // Check if we're inside a delete node by walking up the DOM tree
        let current: Node | null = range.startContainer;
        let deleteNode: HTMLElement | null = null;

        while (current && current !== editorEl) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const elem = current as HTMLElement;
                if (elem.classList.contains(ICE_CLASSES.delete)) {
                    deleteNode = elem;
                    break;
                }
            }
            current = current.parentNode;
        }

        // If we found a delete node ancestor, move cursor after it
        if (deleteNode) {
            range.setStartAfter(deleteNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    private insertIntoExistingNode(
        insertNode: IceNode,
        range: Range,
        selection: Selection,
        options: InsertOptions
    ): void {
        const existingChangeId = insertNode.getAttribute(ICE_ATTRIBUTES.changeId);
        if (!existingChangeId) return;

        this.nodeService.updateChangeTime(existingChangeId);

        if (options.text) {
            this.insertTextIntoNode(insertNode, range, selection, options.text);
        } else if (options.nodes?.length) {
            this.insertNodesIntoExisting(insertNode, range, selection, options.nodes);
        }

        this.stateService.notifyContentChange();
    }

    private insertTextIntoNode(
        insertNode: IceNode,
        range: Range,
        selection: Selection,
        text: string
    ): void {
        // Get the precise insertion point within the insert node
        const insertionPoint = this.getInsertionPointInNode(range, insertNode);

        if (insertionPoint.textNode) {
            // Insert into existing text node
            const textNode = insertionPoint.textNode;
            const currentText = textNode.textContent || '';
            textNode.textContent =
                currentText.substring(0, insertionPoint.offset) +
                text +
                currentText.substring(insertionPoint.offset);

            const newOffset = insertionPoint.offset + text.length;
            range.setStart(textNode, newOffset);
            range.setEnd(textNode, newOffset);
        } else {
            // Create new text node at insertion point
            const newTextNode = document.createTextNode(text);
            if (insertionPoint.beforeNode) {
                insertNode.insertBefore(newTextNode, insertionPoint.beforeNode);
            } else {
                insertNode.appendChild(newTextNode);
            }
            range.setStart(newTextNode, text.length);
            range.setEnd(newTextNode, text.length);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Get precise insertion point within an insert node
     */
    private getInsertionPointInNode(range: Range, insertNode: IceNode): {
        textNode: Text | null;
        offset: number;
        beforeNode: Node | null;
    } {
        const container = range.startContainer;
        const offset = range.startOffset;

        // If directly in a text node inside the insert node
        if (container.nodeType === Node.TEXT_NODE && insertNode.contains(container)) {
            return { textNode: container as Text, offset, beforeNode: null };
        }

        // If in the insert node element itself
        if (container === insertNode) {
            const childNodes = Array.from(insertNode.childNodes);
            if (offset < childNodes.length) {
                const targetNode = childNodes[offset];
                if (targetNode.nodeType === Node.TEXT_NODE) {
                    return { textNode: targetNode as Text, offset: 0, beforeNode: null };
                }
                return { textNode: null, offset: 0, beforeNode: targetNode };
            }
            // At end of insert node
            const lastChild = insertNode.lastChild;
            if (lastChild?.nodeType === Node.TEXT_NODE) {
                return { textNode: lastChild as Text, offset: (lastChild.textContent || '').length, beforeNode: null };
            }
            return { textNode: null, offset: 0, beforeNode: null };
        }

        // Fallback: append to end
        return { textNode: null, offset: 0, beforeNode: null };
    }

    /**
     * Insert nodes (including BR) into existing insert node
     */
    private insertNodesIntoExisting(
        insertNode: IceNode,
        range: Range,
        selection: Selection,
        nodes: Node[]
    ): void {
        const insertionPoint = this.getInsertionPointInNode(range, insertNode);

        // Handle BR insertion specially
        const isBrInsertion = nodes.length === 1 &&
            nodes[0].nodeType === Node.ELEMENT_NODE &&
            (nodes[0] as HTMLElement).tagName === 'BR';

        if (isBrInsertion) {
            this.insertBrIntoNode(insertNode, insertionPoint, range, selection, nodes[0] as HTMLElement);
            return;
        }

        // General node insertion
        if (insertionPoint.textNode) {
            // Split text node and insert
            const textNode = insertionPoint.textNode;
            const textContent = textNode.textContent || '';
            const beforeText = textContent.substring(0, insertionPoint.offset);
            const afterText = textContent.substring(insertionPoint.offset);

            const parent = textNode.parentNode!;
            const frag = document.createDocumentFragment();

            if (beforeText) {
                frag.appendChild(document.createTextNode(beforeText));
            }

            nodes.forEach(node => frag.appendChild(node));

            if (afterText) {
                frag.appendChild(document.createTextNode(afterText));
            }

            parent.replaceChild(frag, textNode);

            // Position cursor after last inserted node
            const lastNode = nodes[nodes.length - 1];
            this.positionCursorAfterNode(lastNode, range, selection);
        } else if (insertionPoint.beforeNode) {
            nodes.forEach(node => {
                insertNode.insertBefore(node, insertionPoint.beforeNode);
            });
            const lastNode = nodes[nodes.length - 1];
            this.positionCursorAfterNode(lastNode, range, selection);
        } else {
            nodes.forEach(node => insertNode.appendChild(node));
            const lastNode = nodes[nodes.length - 1];
            this.positionCursorAfterNode(lastNode, range, selection);
        }
    }

    /**
     * Special handling for BR insertion to maintain proper cursor position
     */
    private insertBrIntoNode(
        insertNode: IceNode,
        insertionPoint: { textNode: Text | null; offset: number; beforeNode: Node | null },
        range: Range,
        selection: Selection,
        br: HTMLElement
    ): void {
        if (insertionPoint.textNode) {
            const textNode = insertionPoint.textNode;
            const textContent = textNode.textContent || '';
            const beforeText = textContent.substring(0, insertionPoint.offset);
            const afterText = textContent.substring(insertionPoint.offset);

            const parent = textNode.parentNode!;
            const frag = document.createDocumentFragment();

            if (beforeText) {
                frag.appendChild(document.createTextNode(beforeText));
            }

            frag.appendChild(br);

            // CRITICAL: After the BR, we need somewhere for the cursor to go
            // If there's after text, use it; otherwise create a placeholder
            if (afterText) {
                const afterTextNode = document.createTextNode(afterText);
                frag.appendChild(afterTextNode);
                parent.replaceChild(frag, textNode);
                // Position cursor at start of after text
                range.setStart(afterTextNode, 0);
                range.setEnd(afterTextNode, 0);
            } else {
                // No text after - we're at the end
                // Add a zero-width space so cursor has somewhere to go
                const placeholder = document.createTextNode('\u200B');
                frag.appendChild(placeholder);
                parent.replaceChild(frag, textNode);
                range.setStart(placeholder, 0);
                range.setEnd(placeholder, 0);
            }
        } else if (insertionPoint.beforeNode) {
            insertNode.insertBefore(br, insertionPoint.beforeNode);
            // Position cursor before the beforeNode (which is now after BR)
            if (insertionPoint.beforeNode.nodeType === Node.TEXT_NODE) {
                range.setStart(insertionPoint.beforeNode, 0);
                range.setEnd(insertionPoint.beforeNode, 0);
            } else {
                range.setStartBefore(insertionPoint.beforeNode);
                range.setEndBefore(insertionPoint.beforeNode);
            }
        } else {
            // Appending BR at end
            insertNode.appendChild(br);
            // Add placeholder for cursor
            const placeholder = document.createTextNode('\u200B');
            insertNode.appendChild(placeholder);
            range.setStart(placeholder, 0);
            range.setEnd(placeholder, 0);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Append content to adjacent insert node
     */
    private appendToAdjacentNode(
        insertNode: IceNode,
        range: Range,
        selection: Selection,
        options: InsertOptions
    ): void {
        const existingChangeId = insertNode.getAttribute(ICE_ATTRIBUTES.changeId);
        if (!existingChangeId) return;

        this.nodeService.updateChangeTime(existingChangeId);

        if (options.text) {
            // Check if last child is a text node
            const lastChild = insertNode.lastChild;
            if (lastChild?.nodeType === Node.TEXT_NODE) {
                lastChild.textContent = (lastChild.textContent || '') + options.text;
                const newOffset = lastChild.textContent.length;
                range.setStart(lastChild, newOffset);
                range.setEnd(lastChild, newOffset);
            } else {
                const textNode = document.createTextNode(options.text);
                insertNode.appendChild(textNode);
                range.setStart(textNode, options.text.length);
                range.setEnd(textNode, options.text.length);
            }
        } else if (options.nodes?.length) {
            const isBrInsertion = options.nodes.length === 1 &&
                options.nodes[0].nodeType === Node.ELEMENT_NODE &&
                (options.nodes[0] as HTMLElement).tagName === 'BR';

            options.nodes.forEach(node => insertNode.appendChild(node));

            if (isBrInsertion) {
                // Add placeholder after BR for cursor positioning
                const placeholder = document.createTextNode('\u200B');
                insertNode.appendChild(placeholder);
                range.setStart(placeholder, 0);
                range.setEnd(placeholder, 0);
            } else {
                const lastNode = options.nodes[options.nodes.length - 1];
                this.positionCursorAfterNode(lastNode, range, selection);
            }
        }

        selection.removeAllRanges();
        selection.addRange(range);

        this.stateService.notifyContentChange();
    }

    private positionCursorAfterNode(node: Node, range: Range, selection: Selection): void {
        const nextSibling = node.nextSibling;
        if (nextSibling) {
            if (nextSibling.nodeType === Node.TEXT_NODE) {
                range.setStart(nextSibling, 0);
                range.setEnd(nextSibling, 0);
            } else {
                range.setStartBefore(nextSibling);
                range.setEndBefore(nextSibling);
            }
        } else {
            range.setStartAfter(node);
            range.setEndAfter(node);
        }
        selection.removeAllRanges();
        selection.addRange(range);
    }

    private createNewInsertNode(
        changeId: string,
        range: Range,
        selection: Selection,
        options: InsertOptions
    ): void {
        const insertNode = this.nodeService.createIceNode(CHANGE_TYPES.INSERT, changeId);

        if (options.text) {
            insertNode.textContent = options.text;
        } else if (options.nodes?.length) {
            const isBrOnly = options.nodes.length === 1 &&
                options.nodes[0].nodeType === Node.ELEMENT_NODE &&
                (options.nodes[0] as HTMLElement).tagName === 'BR';

            options.nodes.forEach(node => insertNode.appendChild(node));

            if (isBrOnly) {
                // Add placeholder for cursor
                const placeholder = document.createTextNode('\u200B');
                insertNode.appendChild(placeholder);
            }
        }

        range.insertNode(insertNode);

        // Position cursor at end
        if (insertNode.lastChild) {
            if (insertNode.lastChild.nodeType === Node.TEXT_NODE) {
                const len = insertNode.lastChild.textContent?.length || 0;
                range.setStart(insertNode.lastChild, len);
                range.setEnd(insertNode.lastChild, len);
            } else {
                range.setStartAfter(insertNode.lastChild);
                range.setEndAfter(insertNode.lastChild);
            }
        } else {
            range.setStartAfter(insertNode);
            range.setEndAfter(insertNode);
        }

        selection.removeAllRanges();
        selection.addRange(range);

        this.addChangeRecord(changeId, [insertNode]);
        this.stateService.notifyContentChange();
    }

    private insertNodesIntoElement(
        element: HTMLElement,
        range: Range,
        selection: Selection,
        nodes: Node[]
    ): void {
        const offset = this.domService.getOffsetInNode(range, element);
        const textContent = element.textContent || '';

        if (element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE) {
            const beforeText = textContent.substring(0, offset);
            const afterText = textContent.substring(offset);

            element.innerHTML = '';

            if (beforeText) {
                element.appendChild(document.createTextNode(beforeText));
            }

            nodes.forEach(node => element.appendChild(node));

            if (afterText) {
                element.appendChild(document.createTextNode(afterText));
            }
        } else {
            const lastNode = nodes[nodes.length - 1];
            nodes.forEach(node => range.insertNode(node));

            if (lastNode) {
                range.setStartAfter(lastNode);
                range.setEndAfter(lastNode);
            }
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    private addChangeRecord(changeId: string, nodes: IceNode[]): void {
        const user = this.stateService.getCurrentUser();
        const record: ChangeRecord = {
            id: changeId,
            type: 'insert',
            userId: user.id,
            userName: user.name,
            timestamp: new Date(),
            content: nodes.map(n => n.textContent || '').join(''),
            spanElement: nodes[0]
        };
        this.stateService.addChange(record);
    }
}