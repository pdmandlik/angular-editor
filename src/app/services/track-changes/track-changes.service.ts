import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TrackChangesState, ChangeRecord, EditorOutputMode } from '../../entities/editor-config';
import { EnterKeyService } from '../enter-key.service';

// Import sub-services
import { TrackChangesStateService } from './track-changes-state.service';
import { TrackChangesNodeService } from './track-changes-node.service';
import { TrackChangesDomService } from './track-changes-dom.service';
import { TrackChangesInsertService, InsertOptions } from './track-changes-insert.service';
import { TrackChangesDeleteService } from './track-changes-delete.service';
import { TrackChangesAcceptRejectService } from './track-changes-accept-reject.service';
import { TrackChangesEventService } from './track-changes-event.service';
import { IceNode, ICE_ATTRIBUTES, ICE_CLASSES } from './track-changes.constants';

/**
 * Main TrackChangesService - Orchestrator/Facade
 * 
 * This service coordinates all track changes functionality through sub-services.
 * It maintains backward compatibility with the original API while delegating
 * to specialized services for each concern.
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesService {
    constructor(
        private stateService: TrackChangesStateService,
        private nodeService: TrackChangesNodeService,
        private domService: TrackChangesDomService,
        private insertService: TrackChangesInsertService,
        private deleteService: TrackChangesDeleteService,
        private acceptRejectService: TrackChangesAcceptRejectService,
        private eventService: TrackChangesEventService
    ) { }

    // ============================================================================
    // SERVICE CONFIGURATION
    // ============================================================================

    setContentChangeCallback(callback: () => void): void {
        this.stateService.setContentChangeCallback(callback);
    }

    setEnterKeyService(service: EnterKeyService): void {
        this.eventService.setEnterKeyService(service);
    }

    // ============================================================================
    // STATE ACCESSORS (Delegated to StateService)
    // ============================================================================

    getState(): Observable<TrackChangesState> {
        return this.stateService.getState();
    }

    getCurrentState(): TrackChangesState {
        return this.stateService.getCurrentState();
    }

    isTracking(): boolean {
        return this.stateService.isEnabled();
    }

    isVisible(): boolean {
        return this.stateService.isVisible();
    }

    // ============================================================================
    // USER MANAGEMENT
    // ============================================================================

    setCurrentUser(user: { id: string; name: string }): void {
        this.stateService.setCurrentUser(user);
        // Update existing nodes with new username
        const editorEl = this.stateService.getEditorElement();
        if (editorEl) {
            const userNodes = editorEl.querySelectorAll(
                `[${ICE_ATTRIBUTES.userId}="${user.id}"]`
            );
            userNodes.forEach(node => {
                node.setAttribute(ICE_ATTRIBUTES.userName, user.name);
            });
        }
    }

    startNewSession(): void {
        this.stateService.startNewSession();
    }

    // ============================================================================
    // ENABLE/DISABLE TRACKING
    // ============================================================================

    enableTracking(element: HTMLElement): void {
        if (this.stateService.isEnabled()) return;

        this.stateService.setEditorElement(element);
        this.eventService.attachEventListeners();
        this.initializeExistingContent();
        this.stateService.setEnabled(true);
    }

    disableTracking(): void {
        if (!this.stateService.isEnabled()) return;

        this.stateService.endBatchChange();
        this.eventService.detachEventListeners();
        this.stateService.setEditorElement(null);
        this.stateService.setEnabled(false);
    }

    // ============================================================================
    // VISIBILITY TOGGLE
    // ============================================================================

    toggleShowChanges(visible: boolean): void {
        this.domService.toggleNodesVisibility(visible);
        this.stateService.setVisible(visible);
    }

    // ============================================================================
    // CONTENT OUTPUT
    // ============================================================================

    getContent(element: HTMLElement, mode: EditorOutputMode): string {
        return this.domService.getContent(element, mode);
    }

    // ============================================================================
    // CHANGE ACCESS
    // ============================================================================

    getChanges(): { [id: string]: ChangeRecord } {
        return this.stateService.getChanges();
    }

    countChanges(): number {
        return this.stateService.countChanges();
    }

    getChangeById(changeId: string): ChangeRecord | null {
        return this.stateService.getChangeById(changeId);
    }

    getPendingChanges(): ChangeRecord[] {
        return this.stateService.getPendingChanges();
    }

    getChangeElement(changeId: string): HTMLElement | null {
        return this.nodeService.getChangeElement(changeId);
    }

    // ============================================================================
    // INSERT OPERATIONS (Delegated to InsertService)
    // ============================================================================

    insert(options: InsertOptions): void {
        this.insertService.insert(options, (range) => this.deleteService.deleteSelection(range));
    }

    // ============================================================================
    // DELETE OPERATIONS (Delegated to DeleteService)
    // ============================================================================

    deleteContents(isForward: boolean, isWord: boolean = false): void {
        this.deleteService.deleteContents(isForward, isWord);
    }

    // ============================================================================
    // ACCEPT/REJECT (Delegated to AcceptRejectService)
    // ============================================================================

    acceptChange(changeId?: string): void {
        this.acceptRejectService.acceptChange(changeId);
    }

    rejectChange(changeId?: string): void {
        this.acceptRejectService.rejectChange(changeId);
    }

    acceptAllChanges(): void {
        this.acceptRejectService.acceptAllChanges();
    }

    rejectAllChanges(): void {
        this.acceptRejectService.rejectAllChanges();
    }

    acceptChangeAtSelection(): boolean {
        return this.acceptRejectService.acceptChangeAtSelection();
    }

    rejectChangeAtSelection(): boolean {
        return this.acceptRejectService.rejectChangeAtSelection();
    }

    // Aliases for backward compatibility
    acceptAll(): void {
        this.acceptAllChanges();
    }

    rejectAll(): void {
        this.rejectAllChanges();
    }

    // ============================================================================
    // NODE UTILITIES (Delegated to NodeService)
    // ============================================================================

    currentChangeNode(): IceNode | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        return this.nodeService.getIceNodeAtRange(range);
    }

    isInsideChange(): boolean {
        return this.currentChangeNode() !== null;
    }

    removeEmptyNodes(): void {
        this.nodeService.removeEmptyNodes();
    }

    // ============================================================================
    // RELOAD & RESET
    // ============================================================================

    reload(): void {
        this.loadFromDom();
    }

    reloadFromDom(): void {
        this.reload();
    }

    reset(): void {
        this.disableTracking();
        this.stateService.reset();
    }

    // ============================================================================
    // MERGE UTILITIES
    // ============================================================================

    mergeAdjacentInsertNodes(): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        const selection = window.getSelection();
        const savedRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;

        const insertNodes = editorEl.querySelectorAll(`.${ICE_CLASSES.insert}`);
        const processed = new Set<HTMLElement>();

        insertNodes.forEach((node) => {
            const el = node as HTMLElement;
            if (processed.has(el)) return;

            let current = el;
            let next = current.nextSibling;

            while (next) {
                // Skip whitespace-only text nodes
                if (next.nodeType === Node.TEXT_NODE && !next.textContent?.trim()) {
                    next = next.nextSibling;
                    continue;
                }

                // Check if next is a mergeable insert node
                if (next.nodeType === Node.ELEMENT_NODE) {
                    const nextEl = next as HTMLElement;
                    if (nextEl.classList.contains(ICE_CLASSES.insert) &&
                        this.canMergeNodes(current, nextEl)) {
                        // Merge content
                        while (nextEl.firstChild) {
                            current.appendChild(nextEl.firstChild);
                        }
                        const toRemove = nextEl;
                        next = nextEl.nextSibling;
                        toRemove.parentNode?.removeChild(toRemove);
                        processed.add(nextEl);
                        continue;
                    }
                }
                break;
            }

            processed.add(el);
        });

        // Restore selection
        if (savedRange && selection) {
            selection.removeAllRanges();
            selection.addRange(savedRange);
        }
    }

    private canMergeNodes(node1: HTMLElement, node2: HTMLElement): boolean {
        const userId1 = node1.getAttribute(ICE_ATTRIBUTES.userId);
        const userId2 = node2.getAttribute(ICE_ATTRIBUTES.userId);
        const sessionId1 = node1.getAttribute(ICE_ATTRIBUTES.sessionId);
        const sessionId2 = node2.getAttribute(ICE_ATTRIBUTES.sessionId);

        return userId1 === userId2 && sessionId1 === sessionId2;
    }

    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================

    private initializeExistingContent(): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        const iceNodes = editorEl.querySelectorAll(
            `.${ICE_CLASSES.insert}, .${ICE_CLASSES.delete}`
        );

        iceNodes.forEach((node: Element) => {
            const iceNode = node as IceNode;
            const changeId = iceNode.getAttribute(ICE_ATTRIBUTES.changeId);

            if (changeId && !this.stateService.getChangeById(changeId)) {
                const changeType = iceNode.classList.contains(ICE_CLASSES.insert) ? 'insert' : 'delete';
                const record: ChangeRecord = {
                    id: changeId,
                    type: changeType,
                    userId: iceNode.getAttribute(ICE_ATTRIBUTES.userId) || '',
                    userName: iceNode.getAttribute(ICE_ATTRIBUTES.userName) || '',
                    timestamp: new Date(parseInt(iceNode.getAttribute(ICE_ATTRIBUTES.time) || '0')),
                    content: this.nodeService.getNodeContent(iceNode),
                    spanElement: iceNode
                };
                this.stateService.addChange(record);
            }
        });
    }

    private loadFromDom(): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        this.stateService.clearChanges();

        const iceNodes = editorEl.querySelectorAll(
            `.${ICE_CLASSES.insert}, .${ICE_CLASSES.delete}`
        );

        iceNodes.forEach((node: Element) => {
            const element = node as HTMLElement;
            const changeId = element.getAttribute(ICE_ATTRIBUTES.changeId);
            if (!changeId) return;

            const type: 'insert' | 'delete' = element.classList.contains(ICE_CLASSES.insert)
                ? 'insert'
                : 'delete';

            const timeStr = element.getAttribute(ICE_ATTRIBUTES.time);
            const record: ChangeRecord = {
                id: changeId,
                type: type,
                userId: element.getAttribute(ICE_ATTRIBUTES.userId) || '',
                userName: element.getAttribute(ICE_ATTRIBUTES.userName) || '',
                timestamp: timeStr ? new Date(parseInt(timeStr, 10)) : new Date(),
                content: element.textContent || '',
                spanElement: element,
                isAccepted: false,
                isRejected: false
            };

            this.stateService.addChange(record);
        });
    }
}