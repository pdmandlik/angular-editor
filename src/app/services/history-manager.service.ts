import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Snapshot structure - mirrors CKEditor's Image class
 * Stores both content and selection state
 */
interface Snapshot {
    contents: string;
    selectionStart: number | null;
    selectionEnd: number | null;
}

/**
 * Key groups for typing detection (like CKEditor)
 */
enum KeyGroup {
    PRINTABLE = 0,
    FUNCTIONAL = 1  // Backspace, Delete
}

/**
 * History Manager Service - Matching CKEditor 4's UndoManager Logic
 * 
 * Key CKEditor patterns implemented:
 * 1. Single array with index pointer (not separate undo/redo stacks)
 * 2. Save current state BEFORE undo/redo
 * 3. Lock mechanism during restore
 * 4. Duplicate detection before saving
 * 5. Typing mode with stroke counting
 * 6. Selection/cursor restoration
 */
@Injectable({
    providedIn: 'root'
})
export class HistoryManagerService {
    // === CKEditor-style snapshot array with index pointer ===
    private snapshots: Snapshot[] = [];
    private index = -1;
    private currentImage: Snapshot | null = null;

    // === State flags ===
    private hasUndo = false;
    private hasRedo = false;
    private locked: { level: number } | null = null;
    private enabled = true;

    // === Typing state (CKEditor pattern) ===
    private typing = false;
    private strokesRecorded: [number, number] = [0, 0]; // [PRINTABLE, FUNCTIONAL]
    private previousKeyGroup = -1;

    // === Configuration ===
    private readonly limit = 100;           // Max snapshots
    private readonly strokesLimit = 25;     // Keystrokes before auto-snapshot

    // === Editor reference ===
    private editorElement: HTMLElement | null = null;

    // === Track changes integration ===
    private trackChangesReloadCallback: (() => void) | null = null;

    // === Event emitters ===
    public onChange$ = new Subject<void>();
    public afterUndo$ = new Subject<void>();
    public afterRedo$ = new Subject<void>();

    // === Snapshot timing (debounce) ===
    private snapshotTimer: any = null;
    private readonly snapshotDelay = 800; // ms

    /**
     * Set the editor element reference
     */
    setEditorElement(element: HTMLElement): void {
        this.editorElement = element;
    }

    /**
     * Get the editor element
     */
    getEditorElement(): HTMLElement | null {
        return this.editorElement;
    }

    /**
     * Register track changes reload callback
     * This is called after undo/redo to sync tracker state with DOM
     */
    setTrackChangesReloadCallback(callback: () => void): void {
        this.trackChangesReloadCallback = callback;
    }

    /**
     * Initialize/reset the undo manager
     */
    reset(): void {
        this.snapshots = [];
        this.index = -1;
        this.currentImage = null;
        this.hasUndo = false;
        this.hasRedo = false;
        this.locked = null;
        this.resetType();
    }

    /**
     * Initialize with content and save initial snapshot
     */
    initialize(content?: string): void {
        this.reset();

        if (content && this.editorElement) {
            this.editorElement.innerHTML = content;
        }

        // Save initial snapshot (like CKEditor's instanceReady -> saveSnapshot)
        this.save();
    }

    /**
     * Reset typing state
     */
    private resetType(): void {
        this.strokesRecorded = [0, 0];
        this.typing = false;
        this.previousKeyGroup = -1;

        if (this.snapshotTimer) {
            clearTimeout(this.snapshotTimer);
            this.snapshotTimer = null;
        }
    }

    /**
     * Get key group for a key code
     */
    private static getKeyGroup(keyCode: number): KeyGroup {
        // Backspace = 8, Delete = 46
        return (keyCode === 8 || keyCode === 46) ? KeyGroup.FUNCTIONAL : KeyGroup.PRINTABLE;
    }

    /**
     * Check if key group changed (triggers snapshot)
     */
    private keyGroupChanged(keyCode: number): boolean {
        return HistoryManagerService.getKeyGroup(keyCode) !== this.previousKeyGroup;
    }

    /**
     * Called on content-modifying keystroke
     * Implements CKEditor's typing detection logic
     */
    type(keyCode: number = 0): void {
        const keyGroup = HistoryManagerService.getKeyGroup(keyCode);
        const strokeCount = this.strokesRecorded[keyGroup] + 1;
        const forceSnapshot = strokeCount >= this.strokesLimit;

        // Start typing mode
        if (!this.typing) {
            this.typing = true;
            this.hasUndo = true;
            this.hasRedo = false;
            this.onChange$.next();
        }

        // Check if key group changed (e.g., from typing to deleting)
        if (this.previousKeyGroup !== -1 && this.keyGroupChanged(keyCode)) {
            // Save snapshot when switching between typing and deleting
            this.save();
            this.strokesRecorded = [0, 0];
        }

        if (forceSnapshot) {
            this.strokesRecorded[keyGroup] = 0;
            this.save();
        } else {
            this.strokesRecorded[keyGroup] = strokeCount;
            // Reset debounce timer
            this.resetSnapshotTimer();
        }

        this.previousKeyGroup = keyGroup;
    }

    /**
     * Reset snapshot timer - saves after delay of no typing
     */
    private resetSnapshotTimer(): void {
        if (this.snapshotTimer) {
            clearTimeout(this.snapshotTimer);
        }

        this.snapshotTimer = setTimeout(() => {
            this.stopTyping();
        }, this.snapshotDelay);
    }

    /**
     * Called when user stops typing (navigation, click, blur, etc.)
     */
    stopTyping(): void {
        if (this.typing) {
            this.save();
            this.resetType();
        }
    }

    /**
     * Create a snapshot from current editor state
     */
    private createSnapshot(): Snapshot | null {
        if (!this.editorElement) return null;

        const contents = this.editorElement.innerHTML;
        const selection = window.getSelection();

        let selectionStart: number | null = null;
        let selectionEnd: number | null = null;

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            try {
                selectionStart = this.getCharacterOffset(this.editorElement, range.startContainer, range.startOffset);
                selectionEnd = this.getCharacterOffset(this.editorElement, range.endContainer, range.endOffset);
            } catch (e) {
                // Selection calculation failed
            }
        }

        return {
            contents,
            selectionStart,
            selectionEnd
        };
    }

    /**
     * Calculate character offset from start of editor
     */
    private getCharacterOffset(root: Node, targetNode: Node, offset: number): number {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let charCount = 0;
        let node: Node | null;

        while ((node = walker.nextNode())) {
            if (node === targetNode) {
                return charCount + offset;
            }
            charCount += (node as Text).length;
        }

        // If target is not a text node, count up to it
        if (targetNode.nodeType === Node.ELEMENT_NODE) {
            const iterator = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null);
            charCount = 0;
            while ((node = iterator.nextNode())) {
                if (node === targetNode) {
                    return charCount;
                }
                if (node.nodeType === Node.TEXT_NODE) {
                    charCount += (node as Text).length;
                }
            }
        }

        return charCount;
    }

    /**
     * Check if two snapshots have equal content
     */
    private equalsContent(a: Snapshot, b: Snapshot): boolean {
        return a.contents === b.contents;
    }

    /**
     * Check if two snapshots have equal selection
     */
    private equalsSelection(a: Snapshot, b: Snapshot): boolean {
        return a.selectionStart === b.selectionStart &&
            a.selectionEnd === b.selectionEnd;
    }

    /**
     * Save a snapshot of the current state
     * Implements CKEditor's save() logic
     */
    save(onContentOnly = false): boolean {
        // Don't save if locked or disabled
        if (this.locked || !this.enabled || !this.editorElement) {
            return false;
        }

        // Create new snapshot
        const image = this.createSnapshot();
        if (!image) return false;

        // Check for duplicates (CKEditor pattern)
        if (this.currentImage) {
            if (this.equalsContent(image, this.currentImage)) {
                if (onContentOnly) return false;
                if (this.equalsSelection(image, this.currentImage)) return false;
            }
        }

        // Drop future snapshots (clear redo history)
        this.snapshots.splice(this.index + 1, this.snapshots.length - this.index - 1);

        // Limit stack size
        if (this.snapshots.length >= this.limit) {
            this.snapshots.shift();
            if (this.index > 0) this.index--;
        }

        // Add new snapshot
        this.index = this.snapshots.push(image) - 1;
        this.currentImage = image;

        // Refresh state
        this.refreshState();

        return true;
    }

    /**
     * Get the next/previous snapshot for undo/redo
     */
    private getNextImage(isUndo: boolean): (Snapshot & { index: number }) | null {
        const currentImage = this.currentImage;
        if (!currentImage) return null;

        if (isUndo) {
            // Look backwards for different content
            for (let i = this.index - 1; i >= 0; i--) {
                const image = this.snapshots[i];
                if (!this.equalsContent(currentImage, image)) {
                    return { ...image, index: i };
                }
            }
        } else {
            // Look forwards for different content
            for (let i = this.index + 1; i < this.snapshots.length; i++) {
                const image = this.snapshots[i];
                if (!this.equalsContent(currentImage, image)) {
                    return { ...image, index: i };
                }
            }
        }

        return null;
    }

    /**
     * Restore editor to a snapshot state
     */
    private restoreImage(image: Snapshot & { index: number }): void {
        if (!this.editorElement) return;

        // Lock to prevent saving during restore (CKEditor pattern)
        this.locked = { level: 999 };

        // Restore content
        this.editorElement.innerHTML = image.contents;

        // Restore selection
        this.restoreSelection(image);

        // Unlock
        this.locked = null;

        // Update state
        this.index = image.index;
        this.currentImage = this.snapshots[this.index];

        // Refresh state
        this.refreshState();

        // CRITICAL: Reload track changes from DOM (like LITE plugin does)
        if (this.trackChangesReloadCallback) {
            this.trackChangesReloadCallback();
        }
    }

    /**
     * Restore selection from snapshot
     */
    private restoreSelection(snapshot: Snapshot): void {
        if (!this.editorElement) return;
        if (snapshot.selectionStart === null) {
            this.placeCursorAtEnd();
            return;
        }

        try {
            const range = document.createRange();
            const selection = window.getSelection();

            const startPos = this.findPositionAtOffset(this.editorElement, snapshot.selectionStart);
            const endPos = snapshot.selectionEnd !== null
                ? this.findPositionAtOffset(this.editorElement, snapshot.selectionEnd)
                : startPos;

            if (startPos && endPos) {
                range.setStart(startPos.node, startPos.offset);
                range.setEnd(endPos.node, endPos.offset);
                selection?.removeAllRanges();
                selection?.addRange(range);
            } else {
                this.placeCursorAtEnd();
            }
        } catch (e) {
            this.placeCursorAtEnd();
        }
    }

    /**
     * Find node and offset at character position
     */
    private findPositionAtOffset(root: Node, targetOffset: number): { node: Node; offset: number } | null {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let charCount = 0;
        let node: Node | null;

        while ((node = walker.nextNode())) {
            const textNode = node as Text;
            const nodeLength = textNode.length;

            if (charCount + nodeLength >= targetOffset) {
                return {
                    node: textNode,
                    offset: targetOffset - charCount
                };
            }

            charCount += nodeLength;
        }

        // Target is beyond content, return end position
        const lastNode = this.getLastTextNode(root);
        if (lastNode) {
            return { node: lastNode, offset: (lastNode as Text).length };
        }

        return null;
    }

    /**
     * Get the last text node in a tree
     */
    private getLastTextNode(root: Node): Node | null {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let lastNode: Node | null = null;
        while (walker.nextNode()) {
            lastNode = walker.currentNode;
        }
        return lastNode;
    }

    /**
     * Place cursor at end of editor
     */
    private placeCursorAtEnd(): void {
        if (!this.editorElement) return;

        const range = document.createRange();
        const selection = window.getSelection();

        try {
            range.selectNodeContents(this.editorElement);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        } catch (e) {
            // Cursor placement failed
        }
    }

    /**
     * Refresh hasUndo/hasRedo flags and notify listeners
     */
    private refreshState(): void {
        this.hasUndo = !!this.getNextImage(true);
        this.hasRedo = !!this.getNextImage(false);
        this.resetType();
        this.onChange$.next();
    }

    /**
     * Perform undo operation (CKEditor pattern)
     */
    undo(): boolean {
        if (!this.canUndo()) {
            return false;
        }

        // Stop typing and save current state FIRST (CKEditor pattern)
        if (this.typing) {
            this.stopTyping();
        } else {
            this.save(true);
        }

        const image = this.getNextImage(true);
        if (image) {
            this.restoreImage(image);
            this.afterUndo$.next();
            return true;
        }

        return false;
    }

    /**
     * Perform redo operation (CKEditor pattern)
     */
    redo(): boolean {
        if (!this.canRedo()) {
            return false;
        }

        // Try to save current state
        this.save(true);

        // Check if still redoable after save
        if (!this.canRedo()) {
            return false;
        }

        const image = this.getNextImage(false);
        if (image) {
            this.restoreImage(image);
            this.afterRedo$.next();
            return true;
        }

        return false;
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        return this.enabled && (this.hasUndo || this.typing);
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
        return this.enabled && this.hasRedo;
    }

    /**
     * Enable/disable the undo manager
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.onChange$.next();
    }

    /**
     * Check if restoring is in progress
     */
    isRestoring(): boolean {
        return this.locked !== null && this.locked.level > 0;
    }

    /**
     * Force save snapshot before command execution
     */
    saveBeforeCommand(): void {
        this.stopTyping();
        this.save();
    }

    /**
     * Save snapshot after command execution
     */
    saveAfterCommand(): void {
        this.save();
    }

    /**
     * Update current snapshot without creating new one
     */
    update(): void {
        if (this.locked) return;

        const newImage = this.createSnapshot();
        if (!newImage || !this.currentImage) return;

        // Only update if content is same but selection different
        if (this.equalsContent(newImage, this.currentImage) &&
            !this.equalsSelection(newImage, this.currentImage)) {
            let i = this.index;
            while (i > 0 && this.equalsContent(this.currentImage, this.snapshots[i - 1])) {
                i--;
            }

            this.snapshots.splice(i, this.index - i + 1, newImage);
            this.index = i;
            this.currentImage = newImage;
        }
    }

    /**
     * Get debug info
     */
    getDebugInfo(): object {
        return {
            snapshotCount: this.snapshots.length,
            currentIndex: this.index,
            hasUndo: this.hasUndo,
            hasRedo: this.hasRedo,
            typing: this.typing,
            locked: this.locked !== null,
            strokesRecorded: this.strokesRecorded
        };
    }
}