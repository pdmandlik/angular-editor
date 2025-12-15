import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import {
    IceNode,
    ICE_ATTRIBUTES,
    ICE_CLASSES,
    CHANGE_TYPES,
    STYLE_PREFIX,
    INSERT_STYLES,
    DELETE_STYLES,
    isIceNode
} from './track-changes.constants';

/**
 * Handles ICE node creation, querying, and validation.
 * Responsible for all track change DOM node operations.
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesNodeService {
    constructor(private stateService: TrackChangesStateService) { }

    // ============================================================================
    // NODE CREATION
    // ============================================================================

    /**
     * Create a new ICE node (insert or delete span)
     */
    createIceNode(changeType: string, changeId: string): IceNode {
        const user = this.stateService.getCurrentUser();
        const sessionId = this.stateService.getSessionId();
        const tag = changeType === CHANGE_TYPES.INSERT ? 'ins' : 'del';
        const node = document.createElement(tag) as IceNode;

        // Set ICE.js standard attributes
        node.setAttribute(ICE_ATTRIBUTES.changeId, changeId);
        node.setAttribute(ICE_ATTRIBUTES.userId, user.id);
        node.setAttribute(ICE_ATTRIBUTES.userName, user.name);
        node.setAttribute(ICE_ATTRIBUTES.sessionId, sessionId);
        node.setAttribute(ICE_ATTRIBUTES.time, String(Date.now()));
        node.setAttribute(ICE_ATTRIBUTES.lastTime, String(Date.now()));

        // Set CSS class
        node.className = changeType === CHANGE_TYPES.INSERT
            ? ICE_CLASSES.insert
            : ICE_CLASSES.delete;

        // Add user-specific style class
        node.classList.add(this.getUserStyleClass(user.id));

        // Apply inline styles
        if (changeType === CHANGE_TYPES.INSERT) {
            node.style.backgroundColor = INSERT_STYLES.backgroundColor;
            node.style.textDecoration = INSERT_STYLES.textDecoration;
        } else {
            node.style.backgroundColor = DELETE_STYLES.backgroundColor;
            node.style.textDecoration = DELETE_STYLES.textDecoration;
            node.style.color = DELETE_STYLES.color;
        }

        node.setAttribute('contenteditable', 'true');
        node._iceNodeId = changeId;

        return node;
    }

    /**
     * Get user-specific style class name
     */
    getUserStyleClass(userId: string): string {
        const userIndex = userId.charCodeAt(0) % 10;
        return `${STYLE_PREFIX}-${userIndex}`;
    }

    // ============================================================================
    // NODE QUERYING
    // ============================================================================

    /**
     * Get ICE node at a specific range position
     */
    getIceNodeAtRange(range: Range): IceNode | null {
        let node: Node | null = range.startContainer;

        while (node && node !== this.stateService.getEditorElement()) {
            if (isIceNode(node)) {
                return node as IceNode;
            }
            node = node.parentNode;
        }

        return null;
    }

    /**
     * Get ICE node of specific type containing the given node
     */
    getIceNode(node: Node, changeType: string): IceNode | null {
        const className = changeType === CHANGE_TYPES.INSERT
            ? ICE_CLASSES.insert
            : ICE_CLASSES.delete;

        let current: Node | null = node;
        const editorEl = this.stateService.getEditorElement();

        while (current && current !== editorEl) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const element = current as HTMLElement;
                if (element.classList.contains(className)) {
                    return element as IceNode;
                }
            }
            current = current.parentNode;
        }

        return null;
    }

    /**
     * Get current user's ICE node containing the given node
     */
    getCurrentUserIceNode(node: Node, changeType: string): IceNode | null {
        const iceNode = this.getIceNode(node, changeType);
        if (iceNode && this.isCurrentUserIceNode(iceNode)) {
            return iceNode;
        }
        return null;
    }

    /**
     * Check if an ICE node belongs to the current user and session
     */
    isCurrentUserIceNode(node: IceNode): boolean {
        const user = this.stateService.getCurrentUser();
        const sessionId = this.stateService.getSessionId();

        const nodeUserId = node.getAttribute(ICE_ATTRIBUTES.userId);
        const nodeSessionId = node.getAttribute(ICE_ATTRIBUTES.sessionId);

        return nodeUserId === user.id && nodeSessionId === sessionId;
    }

    /**
     * Get adjacent insert node that belongs to current user
     * (when cursor is right after an insert node)
     */
    getAdjacentCurrentUserInsertNode(range: Range): IceNode | null {
        if (!range.collapsed) return null;

        const container = range.startContainer;
        const offset = range.startOffset;

        // Case 1: Cursor is in a text node at position 0
        if (container.nodeType === Node.TEXT_NODE && offset === 0) {
            const prevSibling = container.previousSibling;
            if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
                const prevElement = prevSibling as HTMLElement;
                if (prevElement.classList.contains(ICE_CLASSES.insert) &&
                    this.isCurrentUserIceNode(prevElement as IceNode)) {
                    return prevElement as IceNode;
                }
            }
        }

        // Case 2: Cursor is at element boundary
        if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
            const prevChild = container.childNodes[offset - 1];
            if (prevChild && prevChild.nodeType === Node.ELEMENT_NODE) {
                const prevElement = prevChild as HTMLElement;
                if (prevElement.classList.contains(ICE_CLASSES.insert) &&
                    this.isCurrentUserIceNode(prevElement as IceNode)) {
                    return prevElement as IceNode;
                }
            }
        }

        return null;
    }

    /**
     * Get adjacent delete node for merging
     */
    getAdjacentDeleteNode(textNode: Text, moveLeft: boolean): IceNode | null {
        if (moveLeft) {
            const nextSibling = textNode.nextSibling;
            if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
                const elem = nextSibling as HTMLElement;
                if (elem.classList.contains(ICE_CLASSES.delete) &&
                    this.isCurrentUserIceNode(elem as IceNode) &&
                    !this.containsBlockElement(elem)) {
                    return elem as IceNode;
                }
            }
        } else {
            const prevSibling = textNode.previousSibling;
            if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
                const elem = prevSibling as HTMLElement;
                if (elem.classList.contains(ICE_CLASSES.delete) &&
                    this.isCurrentUserIceNode(elem as IceNode) &&
                    !this.containsBlockElement(elem)) {
                    return elem as IceNode;
                }
            }
        }
        return null;
    }

    // ============================================================================
    // NODE UTILITIES
    // ============================================================================

    /**
     * Update the timestamp on a change node
     */
    updateChangeTime(changeId: string): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        const nodes = editorEl.querySelectorAll(
            `[${ICE_ATTRIBUTES.changeId}="${changeId}"]`
        );
        nodes.forEach(node => {
            node.setAttribute(ICE_ATTRIBUTES.lastTime, String(Date.now()));
        });

        // Also update the change record
        const change = this.stateService.getChangeById(changeId);
        if (change) {
            this.stateService.updateChange(changeId, { timestamp: new Date() });
        }
    }

    /**
     * Get DOM element for a change ID
     */
    getChangeElement(changeId: string): HTMLElement | null {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return null;
        return editorEl.querySelector(`[${ICE_ATTRIBUTES.changeId}="${changeId}"]`);
    }

    /**
     * Get all nodes for a change ID
     */
    getChangeNodes(changeId: string): NodeListOf<Element> | null {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return null;
        return editorEl.querySelectorAll(`[${ICE_ATTRIBUTES.changeId}="${changeId}"]`);
    }

    /**
     * Check if element contains block elements
     */
    containsBlockElement(element: HTMLElement): boolean {
        return element.querySelector('br, p, div, h1, h2, h3, h4, h5, h6, ul, ol, li') !== null;
    }

    /**
     * Remove empty ICE nodes from the editor
     */
    removeEmptyNodes(): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        const emptyInserts = editorEl.querySelectorAll(`.${ICE_CLASSES.insert}:empty`);
        emptyInserts.forEach(node => node.parentNode?.removeChild(node));

        const emptyDeletes = editorEl.querySelectorAll(`.${ICE_CLASSES.delete}:empty`);
        emptyDeletes.forEach(node => node.parentNode?.removeChild(node));
    }

    /**
     * Find ancestor that is a track changes span
     */
    findAncestorTrackSpan(node: Node): HTMLElement | null {
        const editorEl = this.stateService.getEditorElement();
        let current: Node | null = node;

        while (current && current !== editorEl) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const element = current as HTMLElement;
                if (element.classList.contains(ICE_CLASSES.insert) ||
                    element.classList.contains(ICE_CLASSES.delete)) {
                    return element;
                }
            }
            current = current.parentNode;
        }

        return null;
    }

    /**
     * Get text content from a node
     */
    getNodeContent(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }
        return (node as HTMLElement).textContent || '';
    }
}