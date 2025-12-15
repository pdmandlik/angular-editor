import { Injectable } from '@angular/core';
import { EnterMode, DEFAULT_EDITOR_CONFIG } from '../entities/editor-config';

/**
 * Service to handle Enter and Shift+Enter key behavior in the editor.
 * Mimics CKEditor 4's enterMode and shiftEnterMode configuration.
 */
@Injectable({
    providedIn: 'root'
})
export class EnterKeyService {
    private enterMode: EnterMode = DEFAULT_EDITOR_CONFIG.enterMode;
    private shiftEnterMode: EnterMode = DEFAULT_EDITOR_CONFIG.shiftEnterMode;
    private editorElement: HTMLElement | null = null;

    /**
     * Configure the Enter key modes
     */
    configure(enterMode: EnterMode, shiftEnterMode: EnterMode): void {
        this.enterMode = enterMode;
        this.shiftEnterMode = shiftEnterMode;
    }

    /**
     * Set the editor element reference
     */
    setEditorElement(element: HTMLElement): void {
        this.editorElement = element;
    }

    /**
     * Get current Enter mode
     */
    getEnterMode(): EnterMode {
        return this.enterMode;
    }

    /**
     * Get current Shift+Enter mode
     */
    getShiftEnterMode(): EnterMode {
        return this.shiftEnterMode;
    }

    /**
     * Get the block element tag name for the current enter mode
     */
    getBlockTagForMode(mode: EnterMode): string {
        switch (mode) {
            case EnterMode.ENTER_P:
                return 'p';
            case EnterMode.ENTER_DIV:
                return 'div';
            case EnterMode.ENTER_BR:
            default:
                return 'br';
        }
    }

    /**
     * Execute enter key action in the editor (when track changes is disabled)
     */
    executeEnter(isShiftKey: boolean): boolean {
        if (!this.editorElement) return false;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        const mode = isShiftKey ? this.shiftEnterMode : this.enterMode;

        // Delete any selected content first
        if (!range.collapsed) {
            range.deleteContents();
        }

        if (mode === EnterMode.ENTER_BR) {
            return this.insertLineBreak(range, selection);
        } else {
            return this.splitBlock(range, selection, mode);
        }
    }

    /**
     * Insert a <br> element for line break mode
     */
    private insertLineBreak(range: Range, selection: Selection): boolean {
        const br = document.createElement('br');
        range.insertNode(br);

        // Create a new range after the BR
        const newRange = document.createRange();

        // Check what comes after the BR
        const nextSibling = br.nextSibling;

        if (!nextSibling ||
            (nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent?.trim()) ||
            (nextSibling.nodeType === Node.ELEMENT_NODE && (nextSibling as HTMLElement).tagName === 'BR')) {
            // At end of block or followed by empty content - need a second BR for cursor
            const spacerBr = document.createElement('br');
            br.parentNode?.insertBefore(spacerBr, br.nextSibling);
            newRange.setStartAfter(br);
            newRange.setEndAfter(br);
        } else {
            // There's content after - position cursor at start of next content
            if (nextSibling.nodeType === Node.TEXT_NODE) {
                newRange.setStart(nextSibling, 0);
                newRange.setEnd(nextSibling, 0);
            } else {
                newRange.setStartAfter(br);
                newRange.setEndAfter(br);
            }
        }

        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
    }

    /**
     * Split the current block element for paragraph/div mode
     */
    private splitBlock(range: Range, selection: Selection, mode: EnterMode): boolean {
        const tagName = mode === EnterMode.ENTER_P ? 'p' : 'div';

        // Find the closest block element
        const blockElement = this.findClosestBlock(range.startContainer);

        if (blockElement && this.editorElement?.contains(blockElement)) {
            return this.splitExistingBlock(range, selection, blockElement, tagName);
        } else {
            return this.createNewBlock(range, selection, tagName);
        }
    }

    /**
     * Find the closest block-level ancestor
     */
    private findClosestBlock(node: Node): HTMLElement | null {
        const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'LI', 'TD', 'TH', 'BLOCKQUOTE', 'PRE', 'ADDRESS'];

        let current: Node | null = node;

        while (current && current !== this.editorElement) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const element = current as HTMLElement;
                if (blockTags.includes(element.tagName)) {
                    return element;
                }
            }
            current = current.parentNode;
        }

        return null;
    }

    /**
     * Split an existing block element at the cursor position
     */
    private splitExistingBlock(
        range: Range,
        selection: Selection,
        blockElement: HTMLElement,
        tagName: string
    ): boolean {
        // Create a range from cursor to end of block
        const endRange = document.createRange();
        endRange.setStart(range.startContainer, range.startOffset);

        // Set end to the last child of block element
        if (blockElement.lastChild) {
            if (blockElement.lastChild.nodeType === Node.TEXT_NODE) {
                endRange.setEnd(blockElement.lastChild, (blockElement.lastChild as Text).length);
            } else {
                endRange.setEndAfter(blockElement.lastChild);
            }
        } else {
            endRange.setEnd(blockElement, 0);
        }

        // Extract content after cursor
        const afterContent = endRange.extractContents();

        // Create new block element
        const newBlock = document.createElement(tagName);

        // Add content to new block or a BR placeholder if empty
        if (afterContent.childNodes.length > 0 && this.hasVisibleContent(afterContent)) {
            newBlock.appendChild(afterContent);
        } else {
            // Empty new block - add BR for cursor positioning
            newBlock.appendChild(document.createElement('br'));
        }

        // If original block is now empty, add a BR
        if (!this.hasVisibleContent(blockElement)) {
            // Clear any empty text nodes
            while (blockElement.firstChild) {
                blockElement.removeChild(blockElement.firstChild);
            }
            blockElement.appendChild(document.createElement('br'));
        }

        // Insert new block after current block
        if (blockElement.nextSibling) {
            blockElement.parentNode?.insertBefore(newBlock, blockElement.nextSibling);
        } else {
            blockElement.parentNode?.appendChild(newBlock);
        }

        // CRITICAL: Position cursor at the START of the new block
        this.placeCursorInBlock(newBlock, selection);

        return true;
    }

    /**
     * Create a new block when cursor is not inside a block element
     */
    private createNewBlock(range: Range, selection: Selection, tagName: string): boolean {
        if (!this.editorElement) return false;

        // Get all content before cursor
        const beforeRange = document.createRange();
        beforeRange.setStart(this.editorElement, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        // Get all content after cursor
        const afterRange = document.createRange();
        afterRange.setStart(range.startContainer, range.startOffset);
        afterRange.setEnd(this.editorElement, this.editorElement.childNodes.length);

        // Extract content
        const afterContent = afterRange.extractContents();
        const beforeContent = beforeRange.extractContents();

        // Clear editor
        this.editorElement.innerHTML = '';

        // Create first block with content before cursor
        const firstBlock = document.createElement(tagName);
        if (beforeContent.childNodes.length > 0 && this.hasVisibleContent(beforeContent)) {
            firstBlock.appendChild(beforeContent);
        } else {
            firstBlock.appendChild(document.createElement('br'));
        }

        // Create second block with content after cursor
        const secondBlock = document.createElement(tagName);
        if (afterContent.childNodes.length > 0 && this.hasVisibleContent(afterContent)) {
            secondBlock.appendChild(afterContent);
        } else {
            secondBlock.appendChild(document.createElement('br'));
        }

        // Append both blocks
        this.editorElement.appendChild(firstBlock);
        this.editorElement.appendChild(secondBlock);

        // Position cursor at start of second block
        this.placeCursorInBlock(secondBlock, selection);

        return true;
    }

    /**
     * Check if a node/fragment has visible content
     */
    private hasVisibleContent(node: Node | DocumentFragment): boolean {
        if (node.nodeType === Node.TEXT_NODE) {
            return !!(node.textContent && node.textContent.trim());
        }

        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            // Check for BR - a lone BR is not considered "visible content" for our purposes
            const element = node as HTMLElement | DocumentFragment;

            // Check text content
            if (element.textContent && element.textContent.trim()) {
                return true;
            }

            // Check for images or other non-text visible elements
            if ('querySelector' in element) {
                if (element.querySelector('img, table, hr')) {
                    return true;
                }
            }

            return false;
        }

        return false;
    }

    /**
     * Place cursor at the beginning of a block element
     * This is the CRITICAL fix - ensuring cursor is properly inside the new block
     */
    private placeCursorInBlock(block: HTMLElement, selection: Selection): void {
        const newRange = document.createRange();

        // Focus the editor first
        this.editorElement?.focus();

        // Find the first suitable position for the cursor
        const firstChild = block.firstChild;

        if (!firstChild) {
            // Empty block - position at start
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        } else if (firstChild.nodeType === Node.TEXT_NODE) {
            // Text node - position at start of text
            newRange.setStart(firstChild, 0);
            newRange.setEnd(firstChild, 0);
        } else if (firstChild.nodeType === Node.ELEMENT_NODE) {
            const firstElement = firstChild as HTMLElement;

            if (firstElement.tagName === 'BR') {
                // BR element - position before it
                newRange.setStartBefore(firstElement);
                newRange.setEndBefore(firstElement);
            } else {
                // Other element - try to find first text node inside it
                const textNode = this.findFirstTextNode(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else {
                    // No text node found - position at start of element
                    newRange.setStart(firstElement, 0);
                    newRange.setEnd(firstElement, 0);
                }
            }
        } else {
            // Default - position at start of block
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        }

        // Apply the new selection
        selection.removeAllRanges();
        selection.addRange(newRange);

        // Double-check: ensure selection is in the correct block
        // This helps with some browser quirks
        setTimeout(() => {
            const currentSelection = window.getSelection();
            if (currentSelection && currentSelection.rangeCount > 0) {
                const currentRange = currentSelection.getRangeAt(0);
                if (!block.contains(currentRange.startContainer)) {
                    // Selection escaped - force it back
                    currentSelection.removeAllRanges();
                    currentSelection.addRange(newRange);
                }
            }
        }, 0);
    }

    /**
     * Find the first text node within an element (recursive)
     */
    private findFirstTextNode(element: HTMLElement): Text | null {
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];

            if (child.nodeType === Node.TEXT_NODE && child.textContent) {
                return child as Text;
            }

            if (child.nodeType === Node.ELEMENT_NODE) {
                const found = this.findFirstTextNode(child as HTMLElement);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * Ensure editor has proper initial block structure based on enter mode
     */
    ensureProperStructure(): void {
        if (!this.editorElement) return;

        // Only apply for P and DIV modes
        if (this.enterMode === EnterMode.ENTER_BR) return;

        const tagName = this.getBlockTagForMode(this.enterMode);

        // If editor is empty, add a block with BR
        if (!this.editorElement.hasChildNodes() ||
            (this.editorElement.childNodes.length === 1 &&
                this.editorElement.firstChild?.nodeType === Node.TEXT_NODE &&
                !this.editorElement.textContent?.trim())) {
            this.editorElement.innerHTML = '';
            const block = document.createElement(tagName);
            block.appendChild(document.createElement('br'));
            this.editorElement.appendChild(block);
            return;
        }

        // Check if there are orphan text nodes or inline elements at root level
        const childNodes = Array.from(this.editorElement.childNodes);
        let hasOrphanContent = false;
        let hasBlockChildren = false;

        for (const node of childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                hasOrphanContent = true;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                    'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'PRE'];
                if (blockTags.includes(el.tagName)) {
                    hasBlockChildren = true;
                } else {
                    // Inline element at root level
                    hasOrphanContent = true;
                }
            }
        }

        // Only wrap if there's orphan content and no block children
        if (hasOrphanContent && !hasBlockChildren) {
            const fragment = document.createDocumentFragment();
            while (this.editorElement.firstChild) {
                fragment.appendChild(this.editorElement.firstChild);
            }
            const block = document.createElement(tagName);
            block.appendChild(fragment);
            this.editorElement.appendChild(block);
        }
    }
}