import { Injectable } from '@angular/core';
import { SelectionManagerService } from './selection-manager.service';

/**
 * Core service for executing editor commands
 * Handles all document.execCommand operations with proper selection management
 */
@Injectable({
    providedIn: 'root'
})
export class CommandExecutorService {
    constructor(private selectionManager: SelectionManagerService) { }

    /**
     * Execute a command with proper selection restoration
     * @param command - The command to execute
     * @param value - Optional value for the command
     * @param showDefaultUI - Whether to show default UI
     * @returns true if command was executed, false otherwise
     */
    executeCommand(command: string, value: string = '', showDefaultUI = false): boolean {
        const savedRange = this.selectionManager.getSavedRange();

        if (!savedRange || !this.selectionManager.isSelectionValid()) {
            // Try to get current selection for keyboard shortcuts
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const currentRange = selection.getRangeAt(0);
                const editorElement = this.selectionManager.getEditorElement();

                if (editorElement?.contains(currentRange.commonAncestorContainer)) {
                    this.selectionManager.saveSelection();
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }

        try {
            if (!document.queryCommandSupported(command)) {
                return false;
            }

            // Ensure selection is active before command
            this.selectionManager.restoreSelection();

            const result = document.execCommand(command, showDefaultUI, value);

            // Save the new selection state after command
            this.selectionManager.saveSelection();

            return result;
        } catch (error) {
            console.error('Command execution failed:', error);
            return false;
        }
    }

    /**
     * Get the state of a command (for toolbar button active states)
     */
    getCommandState(command: string): boolean {
        try {
            return document.queryCommandState(command);
        } catch (error) {
            return false;
        }
    }

    /**
     * Insert HTML at current selection
     */
    insertHTML(html: string): boolean {
        const selection = window.getSelection();
        const editorElement = this.selectionManager.getEditorElement();

        if (!selection || !editorElement) return false;

        try {
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                if (editorElement.contains(range.startContainer)) {
                    document.execCommand('insertHTML', false, html);
                } else {
                    const newRange = document.createRange();
                    newRange.selectNodeContents(editorElement);
                    newRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    document.execCommand('insertHTML', false, html);
                }
            }

            return true;
        } catch (error) {
            console.error('HTML insertion failed:', error);
            return false;
        }
    }
}