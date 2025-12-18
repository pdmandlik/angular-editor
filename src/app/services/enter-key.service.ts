import { Injectable } from '@angular/core';
import { EnterMode, DEFAULT_EDITOR_CONFIG } from '../entities/editor-config';

/**
 * Service to handle Enter and Shift+Enter key behavior in the editor.
 * Mimics CKEditor 4's enterMode and shiftEnterMode configuration.
 * 
 * FIXED: Now properly handles Enter key inside list items (UL/OL)
 * by creating new LI elements instead of P/DIV elements.
 */
@Injectable({
    providedIn: 'root'
})
export class EnterKeyService {
    private enterMode: EnterMode = DEFAULT_EDITOR_CONFIG.enterMode;
    private shiftEnterMode: EnterMode = DEFAULT_EDITOR_CONFIG.shiftEnterMode;
    private editorElement: HTMLElement | null = null;

    configure(enterMode: EnterMode, shiftEnterMode: EnterMode): void {
        this.enterMode = enterMode;
        this.shiftEnterMode = shiftEnterMode;
    }

    setEditorElement(element: HTMLElement): void {
        this.editorElement = element;
    }

    getEnterMode(): EnterMode {
        return this.enterMode;
    }

    getShiftEnterMode(): EnterMode {
        return this.shiftEnterMode;
    }

    getBlockTagForMode(mode: EnterMode): string {
        switch (mode) {
            case EnterMode.ENTER_P: return 'p';
            case EnterMode.ENTER_DIV: return 'div';
            case EnterMode.ENTER_BR:
            default: return 'br';
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

        // Check if we're inside a list item - this takes priority
        const listItem = this.findClosestListItem(range.startContainer);
        if (listItem) {
            return this.splitListItem(range, selection, listItem);
        }

        if (mode === EnterMode.ENTER_BR) {
            return this.insertLineBreak(range, selection);
        } else {
            return this.splitBlock(range, selection, mode);
        }
    }

    /**
     * Find the closest LI ancestor element
     */
    private findClosestListItem(node: Node): HTMLElement | null {
        let current: Node | null = node;

        while (current && current !== this.editorElement) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const element = current as HTMLElement;
                if (element.tagName === 'LI') {
                    return element;
                }
            }
            current = current.parentNode;
        }

        return null;
    }

    /**
     * Split a list item at the cursor position, creating a new LI
     * This is the KEY fix for bullet/numbered list Enter key behavior
     */
    private splitListItem(range: Range, selection: Selection, listItem: HTMLElement): boolean {
        const parentList = listItem.parentElement;
        if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) {
            return false;
        }

        // Create range from cursor to end of list item
        const endRange = document.createRange();
        endRange.setStart(range.startContainer, range.startOffset);

        if (listItem.lastChild) {
            if (listItem.lastChild.nodeType === Node.TEXT_NODE) {
                endRange.setEnd(listItem.lastChild, (listItem.lastChild as Text).length);
            } else {
                endRange.setEndAfter(listItem.lastChild);
            }
        } else {
            endRange.setEnd(listItem, 0);
        }

        // Extract content after cursor
        const afterContent = endRange.extractContents();

        // Create new list item
        const newListItem = document.createElement('li');

        // Add content to new list item or BR placeholder if empty
        if (afterContent.childNodes.length > 0 && this.hasVisibleContent(afterContent)) {
            newListItem.appendChild(afterContent);
        } else {
            newListItem.appendChild(document.createElement('br'));
        }

        // If original list item is now empty, add a BR
        if (!this.hasVisibleContent(listItem)) {
            while (listItem.firstChild) {
                listItem.removeChild(listItem.firstChild);
            }
            listItem.appendChild(document.createElement('br'));
        }

        // Insert new list item after current one
        if (listItem.nextSibling) {
            parentList.insertBefore(newListItem, listItem.nextSibling);
        } else {
            parentList.appendChild(newListItem);
        }

        // Position cursor at start of new list item
        this.placeCursorInBlock(newListItem, selection);

        return true;
    }

    /**
     * Insert a <br> element for line break mode
     */
    private insertLineBreak(range: Range, selection: Selection): boolean {
        const br = document.createElement('br');
        range.insertNode(br);

        const newRange = document.createRange();
        const nextSibling = br.nextSibling;

        if (!nextSibling ||
            (nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent?.trim()) ||
            (nextSibling.nodeType === Node.ELEMENT_NODE && (nextSibling as HTMLElement).tagName === 'BR')) {
            const spacerBr = document.createElement('br');
            br.parentNode?.insertBefore(spacerBr, br.nextSibling);
            newRange.setStartAfter(br);
            newRange.setEndAfter(br);
        } else {
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
        const blockElement = this.findClosestBlock(range.startContainer);

        if (blockElement && this.editorElement?.contains(blockElement)) {
            return this.splitExistingBlock(range, selection, blockElement, tagName);
        } else {
            return this.createNewBlock(range, selection, tagName);
        }
    }

    /**
     * Find the closest block-level ancestor (excluding LI - handled separately)
     */
    private findClosestBlock(node: Node): HTMLElement | null {
        // Note: LI is NOT in this list - it's handled by findClosestListItem
        const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'TD', 'TH', 'BLOCKQUOTE', 'PRE', 'ADDRESS'];

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
        const endRange = document.createRange();
        endRange.setStart(range.startContainer, range.startOffset);

        if (blockElement.lastChild) {
            if (blockElement.lastChild.nodeType === Node.TEXT_NODE) {
                endRange.setEnd(blockElement.lastChild, (blockElement.lastChild as Text).length);
            } else {
                endRange.setEndAfter(blockElement.lastChild);
            }
        } else {
            endRange.setEnd(blockElement, 0);
        }

        const afterContent = endRange.extractContents();
        const newBlock = document.createElement(tagName);

        if (afterContent.childNodes.length > 0 && this.hasVisibleContent(afterContent)) {
            newBlock.appendChild(afterContent);
        } else {
            newBlock.appendChild(document.createElement('br'));
        }

        if (!this.hasVisibleContent(blockElement)) {
            while (blockElement.firstChild) {
                blockElement.removeChild(blockElement.firstChild);
            }
            blockElement.appendChild(document.createElement('br'));
        }

        if (blockElement.nextSibling) {
            blockElement.parentNode?.insertBefore(newBlock, blockElement.nextSibling);
        } else {
            blockElement.parentNode?.appendChild(newBlock);
        }

        this.placeCursorInBlock(newBlock, selection);
        return true;
    }

    /**
     * Create a new block when cursor is not inside a block element
     */
    private createNewBlock(range: Range, selection: Selection, tagName: string): boolean {
        if (!this.editorElement) return false;

        const beforeRange = document.createRange();
        beforeRange.setStart(this.editorElement, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const afterRange = document.createRange();
        afterRange.setStart(range.startContainer, range.startOffset);
        afterRange.setEndAfter(this.editorElement.lastChild || this.editorElement);

        const beforeContent = beforeRange.extractContents();
        const afterContent = afterRange.extractContents();

        while (this.editorElement.firstChild) {
            this.editorElement.removeChild(this.editorElement.firstChild);
        }

        const firstBlock = document.createElement(tagName);
        if (beforeContent.childNodes.length > 0 && this.hasVisibleContent(beforeContent)) {
            firstBlock.appendChild(beforeContent);
        } else {
            firstBlock.appendChild(document.createElement('br'));
        }

        const secondBlock = document.createElement(tagName);
        if (afterContent.childNodes.length > 0 && this.hasVisibleContent(afterContent)) {
            secondBlock.appendChild(afterContent);
        } else {
            secondBlock.appendChild(document.createElement('br'));
        }

        this.editorElement.appendChild(firstBlock);
        this.editorElement.appendChild(secondBlock);

        this.placeCursorInBlock(secondBlock, selection);
        return true;
    }

    /**
     * Check if node has visible content
     */
    private hasVisibleContent(node: Node): boolean {
        if (node.nodeType === Node.TEXT_NODE) {
            return !!(node.textContent && node.textContent.trim());
        }

        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement | DocumentFragment;

            if (element.textContent && element.textContent.trim()) {
                return true;
            }

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
     */
    private placeCursorInBlock(block: HTMLElement, selection: Selection): void {
        const newRange = document.createRange();
        this.editorElement?.focus();

        const firstChild = block.firstChild;

        if (!firstChild) {
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        } else if (firstChild.nodeType === Node.TEXT_NODE) {
            newRange.setStart(firstChild, 0);
            newRange.setEnd(firstChild, 0);
        } else if (firstChild.nodeType === Node.ELEMENT_NODE) {
            const firstElement = firstChild as HTMLElement;

            if (firstElement.tagName === 'BR') {
                newRange.setStartBefore(firstElement);
                newRange.setEndBefore(firstElement);
            } else {
                const textNode = this.findFirstTextNode(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else {
                    newRange.setStart(firstElement, 0);
                    newRange.setEnd(firstElement, 0);
                }
            }
        } else {
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        }

        selection.removeAllRanges();
        selection.addRange(newRange);

        // Ensure selection is in correct block (browser quirk fix)
        setTimeout(() => {
            const currentSelection = window.getSelection();
            if (currentSelection && currentSelection.rangeCount > 0) {
                const currentRange = currentSelection.getRangeAt(0);
                if (!block.contains(currentRange.startContainer)) {
                    currentSelection.removeAllRanges();
                    currentSelection.addRange(newRange);
                }
            }
        }, 0);
    }

    /**
     * Find first text node within an element
     */
    private findFirstTextNode(element: HTMLElement): Text | null {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
        );
        return walker.nextNode() as Text | null;
    }

    /**
     * Ensure editor has proper initial block structure
     * (Also aliased as ensureProperStructure for backward compatibility)
     */
    ensureProperStructure(): void {
        this.ensureEditorHasBlocks();
    }

    /**
     * Ensure editor has proper initial block structure
     */
    ensureEditorHasBlocks(): void {
        if (!this.editorElement) return;

        const tagName = this.getBlockTagForMode(this.enterMode);
        if (tagName === 'br') return;

        if (!this.editorElement.innerHTML.trim()) {
            const block = document.createElement(tagName);
            block.appendChild(document.createElement('br'));
            this.editorElement.appendChild(block);
            return;
        }

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
                    hasOrphanContent = true;
                }
            }
        }

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