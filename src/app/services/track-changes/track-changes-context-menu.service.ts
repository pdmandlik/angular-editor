import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { ICE_CLASSES, ICE_ATTRIBUTES } from './track-changes.constants';

/**
 * Context menu data interface
 */
export interface TrackChangesContextMenuData {
    changeId: string | null;
    changeType: 'insert' | 'delete' | null;
    userName: string | null;
    timestamp: Date | null;
    hasChanges: boolean;
}

/**
 * Service to handle context menu interactions for track changes.
 * Detects right-clicks on tracked changes and provides context data.
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesContextMenuService {

    constructor(
        private stateService: TrackChangesStateService
    ) { }

    /**
     * Check if an element or its ancestors is a track change node
     * Returns the ice node if found, null otherwise
     */
    findTrackChangeNode(element: HTMLElement | null): HTMLElement | null {
        if (!element) return null;

        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return null;

        let current: HTMLElement | null = element;

        while (current && current !== editorEl && editorEl.contains(current)) {
            if (current.classList?.contains(ICE_CLASSES.insert) ||
                current.classList?.contains(ICE_CLASSES.delete)) {
                return current;
            }
            current = current.parentElement;
        }

        return null;
    }

    /**
     * Get context menu data for a given element
     */
    getContextMenuData(element: HTMLElement | null): TrackChangesContextMenuData {
        const iceNode = this.findTrackChangeNode(element);
        const pendingCount = this.stateService.getCurrentState().pendingCount;
        const hasChanges = pendingCount > 0;

        if (!iceNode) {
            return {
                changeId: null,
                changeType: null,
                userName: null,
                timestamp: null,
                hasChanges
            };
        }

        const changeId = iceNode.getAttribute(ICE_ATTRIBUTES.changeId);
        const changeType = iceNode.classList.contains(ICE_CLASSES.insert) ? 'insert' : 'delete';
        const userName = iceNode.getAttribute(ICE_ATTRIBUTES.userName);
        const timeAttr = iceNode.getAttribute(ICE_ATTRIBUTES.time);
        const timestamp = timeAttr ? new Date(parseInt(timeAttr, 10)) : null;

        return {
            changeId,
            changeType,
            userName,
            timestamp,
            hasChanges
        };
    }

    /**
     * Check if context menu should be shown for this event
     * Returns true if we're inside a track change or if there are pending changes
     */
    shouldShowContextMenu(event: MouseEvent): boolean {
        const target = event.target as HTMLElement;
        const editorEl = this.stateService.getEditorElement();

        // Check if click is inside the editor
        if (!editorEl || !editorEl.contains(target)) {
            return false;
        }

        // Check if we clicked on a track change node
        const iceNode = this.findTrackChangeNode(target);
        if (iceNode) {
            return true;
        }

        // Check if there are any pending changes (for Accept/Reject All)
        const pendingCount = this.stateService.getCurrentState().pendingCount;
        return pendingCount > 0;
    }
}