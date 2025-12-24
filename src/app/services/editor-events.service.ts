/**
 * Editor Events Service
 * 
 * Centralized event handling for the WYSIWYG editor.
 * Extracts event management logic from the main editor component
 * to improve separation of concerns and testability.
 * 
 * Responsibilities:
 * - Keyboard event handling (typing, shortcuts, navigation)
 * - Selection change tracking
 * - Focus/blur management
 * - Context menu coordination
 * - Clipboard operations (when track changes is disabled)
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { HistoryManagerService } from './history-manager.service';
import { EnterKeyService } from './enter-key.service';
import { TrackChangesStateService } from './track-changes';

/** Event types emitted by the service */
export interface EditorKeyboardEvent {
    type: 'typing' | 'navigation' | 'shortcut' | 'command';
    originalEvent: KeyboardEvent;
    handled: boolean;
}

export interface EditorSelectionEvent {
    hasSelection: boolean;
    isCollapsed: boolean;
    range: Range | null;
}

export interface EditorFocusEvent {
    type: 'focus' | 'blur';
    relatedTarget: EventTarget | null;
}

export interface EditorContextMenuEvent {
    position: { x: number; y: number };
    target: HTMLElement;
    shouldShowCustomMenu: boolean;
    menuType: 'trackChanges' | 'table' | null;
}

/** Navigation keys that don't trigger content changes */
const NAVIGATION_KEYS = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End', 'PageUp', 'PageDown'
];

/** Keys that should be ignored for typing events */
const MODIFIER_ONLY_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

@Injectable({ providedIn: 'root' })
export class EditorEventsService implements OnDestroy {
    /** Observable streams for editor events */
    private keyboardEvent$ = new Subject<EditorKeyboardEvent>();
    private selectionEvent$ = new Subject<EditorSelectionEvent>();
    private focusEvent$ = new Subject<EditorFocusEvent>();
    private contextMenuEvent$ = new Subject<EditorContextMenuEvent>();
    private contentChanged$ = new Subject<void>();
    private commandExecuted$ = new Subject<string>();

    /** Internal state */
    private editorElement: HTMLElement | null = null;
    private isTrackChangesEnabled = false;
    private boundListeners = new Map<string, EventListener>();

    constructor(
        private historyManager: HistoryManagerService,
        private trackChangesStateService: TrackChangesStateService
    ) { }

    ngOnDestroy(): void {
        this.detachAllListeners();
    }

    // ========================================================================
    // PUBLIC API - EVENT STREAMS
    // ========================================================================

    /** Keyboard events (typing, navigation, shortcuts) */
    get onKeyboard(): Observable<EditorKeyboardEvent> {
        return this.keyboardEvent$.asObservable();
    }

    /** Selection change events */
    get onSelection(): Observable<EditorSelectionEvent> {
        return this.selectionEvent$.asObservable();
    }

    /** Focus/blur events */
    get onFocus(): Observable<EditorFocusEvent> {
        return this.focusEvent$.asObservable();
    }

    /** Context menu events */
    get onContextMenu(): Observable<EditorContextMenuEvent> {
        return this.contextMenuEvent$.asObservable();
    }

    /** Content change events (debounced) */
    get onContentChanged(): Observable<void> {
        return this.contentChanged$.asObservable();
    }

    /** Command execution events */
    get onCommandExecuted(): Observable<string> {
        return this.commandExecuted$.asObservable();
    }

    // ========================================================================
    // PUBLIC API - INITIALIZATION
    // ========================================================================

    /**
     * Initializes event listeners on the editor element.
     * 
     * @param element - The contenteditable editor element
     * @param trackChangesEnabled - Whether track changes is currently active
     */
    initialize(element: HTMLElement, trackChangesEnabled: boolean): void {
        this.editorElement = element;
        this.isTrackChangesEnabled = trackChangesEnabled;
        this.attachListeners();
    }

    /**
     * Updates track changes state.
     * Some event handling differs based on this state.
     */
    setTrackChangesEnabled(enabled: boolean): void {
        this.isTrackChangesEnabled = enabled;
    }

    /**
     * Notifies that a command was executed (for toolbar actions).
     */
    notifyCommandExecuted(command: string): void {
        this.commandExecuted$.next(command);
    }

    /**
     * Manually triggers content change notification.
     */
    notifyContentChanged(): void {
        this.contentChanged$.next();
    }

    /**
     * Cleans up all event listeners.
     */
    destroy(): void {
        this.detachAllListeners();
        this.editorElement = null;
    }

    // ========================================================================
    // PRIVATE - EVENT LISTENER MANAGEMENT
    // ========================================================================

    private attachListeners(): void {
        if (!this.editorElement) return;

        // Keyboard events
        this.addListener('keydown', this.handleKeydown.bind(this));
        this.addListener('keyup', this.handleKeyup.bind(this));

        // Selection events
        this.addDocumentListener('selectionchange', this.handleSelectionChange.bind(this));

        // Focus events
        this.addListener('focus', this.handleFocus.bind(this));
        this.addListener('blur', this.handleBlur.bind(this));

        // Context menu
        this.addListener('contextmenu', this.handleContextMenu.bind(this));

        // Input events (for content changes when track changes is off)
        this.addListener('input', this.handleInput.bind(this));

        // Click events
        this.addListener('click', this.handleClick.bind(this));
    }

    private detachAllListeners(): void {
        if (this.editorElement) {
            this.boundListeners.forEach((listener, eventType) => {
                if (eventType.startsWith('doc:')) {
                    document.removeEventListener(eventType.slice(4), listener);
                } else {
                    this.editorElement?.removeEventListener(eventType, listener);
                }
            });
        }
        this.boundListeners.clear();
    }

    private addListener(event: string, handler: EventListener): void {
        if (!this.editorElement) return;
        this.editorElement.addEventListener(event, handler);
        this.boundListeners.set(event, handler);
    }

    private addDocumentListener(event: string, handler: EventListener): void {
        document.addEventListener(event, handler);
        this.boundListeners.set(`doc:${event}`, handler);
    }

    // ========================================================================
    // PRIVATE - EVENT HANDLERS
    // ========================================================================

    private handleKeydown(e: Event): void {
        const event = e as KeyboardEvent;

        // Skip modifier-only key presses
        if (MODIFIER_ONLY_KEYS.includes(event.key)) return;

        // Determine event type
        let type: EditorKeyboardEvent['type'] = 'typing';
        let handled = false;

        if (NAVIGATION_KEYS.includes(event.key)) {
            type = 'navigation';
            this.historyManager.stopTyping();
        } else if (event.ctrlKey || event.metaKey) {
            type = 'shortcut';
            handled = this.handleShortcut(event);
        } else if (!this.isTrackChangesEnabled) {
            // Regular typing when track changes is off
            this.historyManager.type();
        }

        this.keyboardEvent$.next({
            type,
            originalEvent: event,
            handled
        });
    }

    private handleKeyup(e: Event): void {
        // Selection might have changed after keyup
        this.emitSelectionState();
    }

    private handleShortcut(event: KeyboardEvent): boolean {
        const key = event.key.toLowerCase();

        switch (key) {
            case 'z':
                event.preventDefault();
                if (event.shiftKey) {
                    this.historyManager.redo();
                } else {
                    this.historyManager.undo();
                }
                return true;

            case 'y':
                event.preventDefault();
                this.historyManager.redo();
                return true;

            case 'a':
                // Let browser handle select all
                return false;

            case 'b':
            case 'i':
            case 'u':
                // Formatting shortcuts - handled by browser or track changes
                return false;

            default:
                return false;
        }
    }

    private handleSelectionChange(): void {
        if (!this.editorElement) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // Only emit if selection is within editor
        if (!this.editorElement.contains(range.commonAncestorContainer)) return;

        this.emitSelectionState();

        // Update history manager
        this.historyManager.update();
    }

    private handleFocus(e: Event): void {
        const event = e as FocusEvent;
        this.historyManager.setEnabled(true);

        this.focusEvent$.next({
            type: 'focus',
            relatedTarget: event.relatedTarget
        });
    }

    private handleBlur(e: Event): void {
        const event = e as FocusEvent;
        this.historyManager.stopTyping();

        this.focusEvent$.next({
            type: 'blur',
            relatedTarget: event.relatedTarget
        });
    }

    private handleContextMenu(e: Event): void {
        const event = e as MouseEvent;
        const target = event.target as HTMLElement;

        const result = this.shouldShowCustomContextMenu(target);

        // Prevent default browser context menu when showing custom menu
        if (result.show) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.contextMenuEvent$.next({
            position: { x: event.clientX, y: event.clientY },
            target,
            shouldShowCustomMenu: result.show,
            menuType: result.type
        });
    }

    private handleInput(): void {
        // Content changed - notify if track changes is off
        // (Track changes handles its own notifications)
        if (!this.isTrackChangesEnabled) {
            this.contentChanged$.next();
        }
    }

    private handleClick(): void {
        this.historyManager.stopTyping();
        this.emitSelectionState();
    }

    // ========================================================================
    // PRIVATE - HELPER METHODS
    // ========================================================================

    private emitSelectionState(): void {
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            this.selectionEvent$.next({
                hasSelection: false,
                isCollapsed: true,
                range: null
            });
            return;
        }

        const range = selection.getRangeAt(0);

        this.selectionEvent$.next({
            hasSelection: true,
            isCollapsed: range.collapsed,
            range: range.cloneRange()
        });
    }

    private shouldShowCustomContextMenu(target: HTMLElement): { show: boolean; type: 'trackChanges' | 'table' | null } {
        if (!this.editorElement) return { show: false, type: null };

        let current: HTMLElement | null = target;

        while (current && current !== this.editorElement) {
            // Check for table cell FIRST
            if (current.tagName === 'TD' || current.tagName === 'TH') {
                return { show: true, type: 'table' };
            }

            // Check for track changes node
            if (current.classList?.contains('ice-ins') || current.classList?.contains('ice-del')) {
                return { show: true, type: 'trackChanges' };
            }

            current = current.parentElement;
        }

        // Check if there are any pending changes (for Accept/Reject All)
        const state = this.trackChangesStateService.getCurrentState();
        if (state.isEnabled && state.pendingCount > 0) {
            return { show: true, type: 'trackChanges' };
        }

        return { show: false, type: null };
    }
}