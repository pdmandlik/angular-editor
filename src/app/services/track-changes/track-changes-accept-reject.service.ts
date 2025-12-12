import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { TrackChangesNodeService } from './track-changes-node.service';
import { ICE_CLASSES, ICE_ATTRIBUTES } from './track-changes.constants';

/**
 * Handles accepting and rejecting track changes.
 * Manages individual and bulk accept/reject operations.
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesAcceptRejectService {
    constructor(
        private stateService: TrackChangesStateService,
        private nodeService: TrackChangesNodeService
    ) { }

    // ============================================================================
    // ACCEPT OPERATIONS
    // ============================================================================

    /**
     * Accept a single change by ID
     */
    acceptChange(changeId?: string): void {
        // If no ID provided, try to get from current selection
        if (!changeId) {
            const node = this.getCurrentChangeNode();
            if (node) {
                changeId = node.getAttribute(ICE_ATTRIBUTES.changeId) || undefined;
            }
        }

        if (!changeId) return;

        const change = this.stateService.getChangeById(changeId);
        if (!change || change.isAccepted || change.isRejected) return;

        const editorEl = this.stateService.getEditorElement();
        const nodes = editorEl?.querySelectorAll(
            `[${ICE_ATTRIBUTES.changeId}="${changeId}"]`
        );

        nodes?.forEach((node: Element) => {
            const element = node as HTMLElement;

            if (element.classList.contains(ICE_CLASSES.insert)) {
                // For insert: unwrap the node (keep content, remove wrapper)
                this.unwrapElement(element);
            } else if (element.classList.contains(ICE_CLASSES.delete)) {
                // For delete: remove the node entirely
                element.parentNode?.removeChild(element);
            }
        });

        this.stateService.markAccepted(changeId);
        this.stateService.notifyContentChange();
    }

    /**
     * Accept all pending changes
     */
    acceptAllChanges(): void {
        const changes = this.stateService.getChanges();
        const changeIds = Object.keys(changes);

        changeIds.forEach(changeId => {
            const change = changes[changeId];
            if (!change.isAccepted && !change.isRejected) {
                this.acceptChange(changeId);
            }
        });
    }

    /**
     * Accept change at current selection
     */
    acceptChangeAtSelection(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        const iceNode = this.nodeService.getIceNodeAtRange(range);

        if (iceNode) {
            const changeId = iceNode.getAttribute(ICE_ATTRIBUTES.changeId);
            if (changeId) {
                this.acceptChange(changeId);
                return true;
            }
        }

        return false;
    }

    // ============================================================================
    // REJECT OPERATIONS
    // ============================================================================

    /**
     * Reject a single change by ID
     */
    rejectChange(changeId?: string): void {
        // If no ID provided, try to get from current selection
        if (!changeId) {
            const node = this.getCurrentChangeNode();
            if (node) {
                changeId = node.getAttribute(ICE_ATTRIBUTES.changeId) || undefined;
            }
        }

        if (!changeId) return;

        const change = this.stateService.getChangeById(changeId);
        if (!change || change.isAccepted || change.isRejected) return;

        const editorEl = this.stateService.getEditorElement();
        const nodes = editorEl?.querySelectorAll(
            `[${ICE_ATTRIBUTES.changeId}="${changeId}"]`
        );

        nodes?.forEach((node: Element) => {
            const element = node as HTMLElement;

            if (element.classList.contains(ICE_CLASSES.insert)) {
                // For insert: remove the node entirely (reject the insertion)
                element.parentNode?.removeChild(element);
            } else if (element.classList.contains(ICE_CLASSES.delete)) {
                // For delete: unwrap the node (restore the content)
                this.unwrapElement(element);
            }
        });

        this.stateService.markRejected(changeId);
        this.stateService.notifyContentChange();
    }

    /**
     * Reject all pending changes
     */
    rejectAllChanges(): void {
        const changes = this.stateService.getChanges();
        const changeIds = Object.keys(changes);

        changeIds.forEach(changeId => {
            const change = changes[changeId];
            if (!change.isAccepted && !change.isRejected) {
                this.rejectChange(changeId);
            }
        });
    }

    /**
     * Reject change at current selection
     */
    rejectChangeAtSelection(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        const iceNode = this.nodeService.getIceNodeAtRange(range);

        if (iceNode) {
            const changeId = iceNode.getAttribute(ICE_ATTRIBUTES.changeId);
            if (changeId) {
                this.rejectChange(changeId);
                return true;
            }
        }

        return false;
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    /**
     * Get current change node from selection
     */
    private getCurrentChangeNode(): HTMLElement | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0);
        return this.nodeService.getIceNodeAtRange(range);
    }

    /**
     * Unwrap an element (keep children, remove wrapper)
     */
    private unwrapElement(element: HTMLElement): void {
        const parent = element.parentNode;
        if (!parent) return;

        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
    }

    // ============================================================================
    // ALIAS METHODS (for backward compatibility)
    // ============================================================================

    acceptAll(): void {
        this.acceptAllChanges();
    }

    rejectAll(): void {
        this.rejectAllChanges();
    }
}