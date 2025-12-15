import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TrackChangesState, ChangeRecord } from '../../entities/editor-config';
import { TrackChangesUser, BATCH_TIMEOUT } from './track-changes.constants';

/**
 * Manages track changes state, user info, session, and change records.
 * Single source of truth for all track changes state.
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesStateService {
    private state$ = new BehaviorSubject<TrackChangesState>({
        isEnabled: false,
        isVisible: true,
        changes: [],
        pendingCount: 0
    });

    private changes: { [id: string]: ChangeRecord } = {};
    private uniqueIdIndex = 1;
    private currentUser: TrackChangesUser = { id: 'user1', name: 'Current User' };
    private sessionId = '';
    private editorElement: HTMLElement | null = null;

    // Batch change tracking
    private batchChangeId: string | null = null;
    private batchChangeTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly BATCH_TIMEOUT = BATCH_TIMEOUT;

    // Callback for content changes
    private onContentChangeCallback: (() => void) | null = null;

    constructor() {
        this.generateSessionId();
    }

    // ============================================================================
    // STATE ACCESSORS
    // ============================================================================

    getState(): Observable<TrackChangesState> {
        return this.state$.asObservable();
    }

    getCurrentState(): TrackChangesState {
        return this.state$.value;
    }

    isEnabled(): boolean {
        return this.state$.value.isEnabled;
    }

    isVisible(): boolean {
        return this.state$.value.isVisible;
    }

    // ============================================================================
    // EDITOR ELEMENT
    // ============================================================================

    setEditorElement(element: HTMLElement | null): void {
        this.editorElement = element;
    }

    getEditorElement(): HTMLElement | null {
        return this.editorElement;
    }

    // ============================================================================
    // USER & SESSION MANAGEMENT
    // ============================================================================

    getCurrentUser(): TrackChangesUser {
        return { ...this.currentUser };
    }

    setCurrentUser(user: TrackChangesUser): void {
        this.currentUser = { ...user };
    }

    getSessionId(): string {
        return this.sessionId;
    }

    generateSessionId(): void {
        const now = new Date();
        this.sessionId = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${now.getTime()}`;
    }

    startNewSession(): void {
        this.endBatchChange();
        this.generateSessionId();
    }

    // ============================================================================
    // CHANGE ID MANAGEMENT
    // ============================================================================

    getNewChangeId(): string {
        const id = this.uniqueIdIndex++;
        if (this.changes[id]) {
            return this.getNewChangeId();
        }
        return String(id);
    }

    // ============================================================================
    // BATCH CHANGE MANAGEMENT
    // ============================================================================

    getBatchChangeId(): string | null {
        return this.batchChangeId;
    }

    startBatchChange(): string | null {
        if (this.batchChangeId) {
            this.resetBatchTimer();
            return null; // Return null to indicate existing batch
        }
        this.batchChangeId = this.getNewChangeId();
        this.resetBatchTimer();
        return this.batchChangeId;
    }

    endBatchChange(changeId?: string): void {
        if (changeId && changeId !== this.batchChangeId) return;
        if (this.batchChangeTimer) {
            clearTimeout(this.batchChangeTimer);
            this.batchChangeTimer = null;
        }
        this.batchChangeId = null;
    }

    private resetBatchTimer(): void {
        if (this.batchChangeTimer) {
            clearTimeout(this.batchChangeTimer);
        }
        this.batchChangeTimer = setTimeout(() => {
            this.endBatchChange();
        }, this.BATCH_TIMEOUT);
    }

    // ============================================================================
    // CHANGE RECORD MANAGEMENT
    // ============================================================================

    getChanges(): { [id: string]: ChangeRecord } {
        return { ...this.changes };
    }

    getChangeById(changeId: string): ChangeRecord | null {
        return this.changes[changeId] || null;
    }

    getPendingChanges(): ChangeRecord[] {
        return Object.values(this.changes).filter(c => !c.isAccepted && !c.isRejected);
    }

    countChanges(): number {
        return this.getPendingChanges().length;
    }

    addChange(record: ChangeRecord): void {
        if (!this.changes[record.id]) {
            this.changes[record.id] = record;
            this.updatePendingCount();
        }
    }

    updateChange(changeId: string, updates: Partial<ChangeRecord>): void {
        const change = this.changes[changeId];
        if (change) {
            Object.assign(change, updates);
            this.updatePendingCount();
        }
    }

    markAccepted(changeId: string): void {
        this.updateChange(changeId, { isAccepted: true });
    }

    markRejected(changeId: string): void {
        this.updateChange(changeId, { isRejected: true });
    }

    clearChanges(): void {
        this.changes = {};
        this.uniqueIdIndex = 1;
        this.updatePendingCount();
    }

    loadChanges(changes: { [id: string]: ChangeRecord }): void {
        this.changes = { ...changes };
        // Update uniqueIdIndex to avoid conflicts
        const maxId = Math.max(0, ...Object.keys(changes).map(id => parseInt(id, 10) || 0));
        this.uniqueIdIndex = maxId + 1;
        this.updatePendingCount();
    }

    // ============================================================================
    // STATE UPDATES
    // ============================================================================

    setEnabled(enabled: boolean): void {
        this.state$.next({
            ...this.state$.value,
            isEnabled: enabled,
            isVisible: enabled ? true : this.state$.value.isVisible
        });
    }

    setVisible(visible: boolean): void {
        this.state$.next({
            ...this.state$.value,
            isVisible: visible
        });
    }

    updatePendingCount(): void {
        const pendingCount = Object.values(this.changes).filter(
            c => !c.isAccepted && !c.isRejected
        ).length;

        this.state$.next({
            ...this.state$.value,
            changes: Object.values(this.changes),
            pendingCount
        });
    }

    // ============================================================================
    // CONTENT CHANGE CALLBACK
    // ============================================================================

    setContentChangeCallback(callback: () => void): void {
        this.onContentChangeCallback = callback;
    }

    notifyContentChange(): void {
        if (this.onContentChangeCallback) {
            this.onContentChangeCallback();
        }
    }

    // ============================================================================
    // RESET
    // ============================================================================

    reset(): void {
        this.endBatchChange();
        this.clearChanges();
        this.editorElement = null;

        this.state$.next({
            isEnabled: false,
            isVisible: true,
            changes: [],
            pendingCount: 0
        });
    }
}