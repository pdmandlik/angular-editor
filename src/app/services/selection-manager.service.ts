import { Injectable } from '@angular/core';

/**
 * Service for managing editor selection and ranges
 * Centralizes all selection-related operations
 */
@Injectable({
    providedIn: 'root'
})
export class SelectionManagerService {
    private savedRange: Range | null = null;
    private editorElement: HTMLElement | null = null;

    /**
     * Set the editor element for selection validation
     */
    setEditorElement(element: HTMLElement): void {
        this.editorElement = element;
    }

    /**
     * Get the current editor element
     */
    getEditorElement(): HTMLElement | null {
        return this.editorElement;
    }

    /**
     * Save the current selection
     */
    saveSelection(): Range | null {
        const selection = window.getSelection();
        if (selection?.rangeCount && this.editorElement) {
            const range = selection.getRangeAt(0);
            if (this.editorElement.contains(range.commonAncestorContainer)) {
                this.savedRange = range.cloneRange();
                return this.savedRange;
            }
        }
        return null;
    }

    /**
     * Restore previously saved selection
     */
    restoreSelection(range: Range | null = this.savedRange): void {
        if (!range) return;

        try {
            if (!this.editorElement?.contains(range.commonAncestorContainer)) {
                this.savedRange = null;
                return;
            }

            if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
                this.savedRange = null;
                return;
            }

            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } catch (error) {
            this.savedRange = null;
        }
    }

    /**
     * Get the saved range
     */
    getSavedRange(): Range | null {
        return this.savedRange;
    }

    /**
     * Check if current selection is valid
     */
    isSelectionValid(): boolean {
        if (!this.savedRange || !this.editorElement) return false;

        try {
            return this.editorElement.contains(this.savedRange.commonAncestorContainer) &&
                document.contains(this.savedRange.startContainer) &&
                document.contains(this.savedRange.endContainer);
        } catch {
            return false;
        }
    }

    /**
     * Select all content in editor
     */
    selectAll(): void {
        if (!this.editorElement) return;

        this.editorElement.focus();

        const range = document.createRange();
        range.selectNodeContents(this.editorElement);

        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }

        this.saveSelection();
    }

    /**
     * Get current selection object
     */
    getCurrentSelection(): Selection | null {
        return window.getSelection();
    }

    /**
     * Clear saved selection
     */
    clearSavedSelection(): void {
        this.savedRange = null;
    }
}