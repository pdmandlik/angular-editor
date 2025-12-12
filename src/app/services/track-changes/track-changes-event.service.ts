import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { TrackChangesInsertService } from './track-changes-insert.service';
import { TrackChangesDeleteService } from './track-changes-delete.service';
import { TrackChangesDomService } from './track-changes-dom.service';
import { TrackChangesNodeService } from './track-changes-node.service';
import { EnterKeyService } from '../enter-key.service';
import { EnterMode } from '../../entities/editor-config';
import { ICE_ATTRIBUTES, CHANGE_TYPES, IceNode } from './track-changes.constants';

/**
 * Handles all event listeners for track changes.
 * Manages keyboard, input, paste, cut, and composition events.
 */
@Injectable({ providedIn: 'root' })
export class TrackChangesEventService {
    private listeners: { [key: string]: EventListener } = {};
    private isComposing = false;
    private enterKeyService: EnterKeyService | null = null;

    constructor(
        private stateService: TrackChangesStateService,
        private insertService: TrackChangesInsertService,
        private deleteService: TrackChangesDeleteService,
        private domService: TrackChangesDomService,
        private nodeService: TrackChangesNodeService
    ) { }

    // ============================================================================
    // SERVICE CONFIGURATION
    // ============================================================================

    setEnterKeyService(service: EnterKeyService): void {
        this.enterKeyService = service;
    }

    // ============================================================================
    // EVENT LISTENER MANAGEMENT
    // ============================================================================

    attachEventListeners(): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        this.listeners['keydown'] = (e: Event) => this.handleKeydown(e as KeyboardEvent);
        this.listeners['beforeinput'] = (e: Event) => this.handleBeforeInput(e as InputEvent);
        this.listeners['compositionstart'] = () => { this.isComposing = true; };
        this.listeners['compositionend'] = (e: Event) => this.handleCompositionEnd(e as CompositionEvent);
        this.listeners['paste'] = (e: Event) => this.handlePaste(e as ClipboardEvent);
        this.listeners['cut'] = (e: Event) => this.handleCut(e as ClipboardEvent);

        // Attach with capture phase for keydown
        editorEl.addEventListener('keydown', this.listeners['keydown'], true);

        // Attach other listeners
        Object.keys(this.listeners).forEach(event => {
            if (event !== 'keydown') {
                editorEl.addEventListener(event, this.listeners[event], true);
            }
        });
    }

    detachEventListeners(): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        Object.keys(this.listeners).forEach(event => {
            editorEl.removeEventListener(event, this.listeners[event], true);
        });

        this.listeners = {};
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    private handleKeydown(event: KeyboardEvent): void {
        if (!this.stateService.isEnabled() || this.isComposing) return;

        // Allow Ctrl/Cmd shortcuts to pass through
        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            const formattingKeys = ['b', 'i', 'u', 'z', 'y'];
            if (formattingKeys.includes(key)) return;
        }

        // Handle Backspace/Delete for browsers without InputEvent support
        if (event.key === 'Backspace' || event.key === 'Delete') {
            if (!('InputEvent' in window)) {
                event.preventDefault();
                this.deleteService.deleteContents(event.key === 'Delete');
            }
        }
    }

    private handleBeforeInput(event: InputEvent): void {
        if (!this.stateService.isEnabled() || this.isComposing) return;

        const inputType = event.inputType;

        // Don't prevent default for formatting commands
        const formattingTypes = [
            'formatBold', 'formatItalic', 'formatUnderline',
            'formatStrikethrough', 'formatSubscript', 'formatSuperscript'
        ];
        if (formattingTypes.includes(inputType)) return;

        // Handle text insertion
        if (inputType === 'insertText' || inputType === 'insertCompositionText') {
            if (!this.isComposing) {
                event.preventDefault();
                this.insertService.insert(
                    { text: event.data || '' },
                    (range) => this.deleteService.deleteSelection(range)
                );
            }
            return;
        }

        // Handle Enter key
        if (inputType === 'insertParagraph') {
            event.preventDefault();
            this.handleEnterKey(false);
            return;
        }

        // Handle Shift+Enter
        if (inputType === 'insertLineBreak') {
            event.preventDefault();
            this.handleEnterKey(true);
            return;
        }

        // Handle delete operations
        if (inputType.startsWith('delete')) {
            event.preventDefault();
            const isForward = inputType.includes('Forward');
            const isWord = inputType.includes('Word');
            this.deleteService.deleteContents(isForward, isWord);
        }
    }

    private handleCompositionEnd(event: CompositionEvent): void {
        this.isComposing = false;
        if (event.data) {
            this.insertService.insert(
                { text: event.data },
                (range) => this.deleteService.deleteSelection(range)
            );
        }
    }

    private handlePaste(event: ClipboardEvent): void {
        if (!this.stateService.isEnabled()) return;

        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') || '';
        if (text) {
            this.insertService.insert(
                { text },
                (range) => this.deleteService.deleteSelection(range)
            );
        }
    }

    private handleCut(event: ClipboardEvent): void {
        if (!this.stateService.isEnabled()) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        event.preventDefault();
        const text = range.toString();
        event.clipboardData?.setData('text/plain', text);
        this.deleteService.deleteContents(false);
    }

    // ============================================================================
    // ENTER KEY HANDLING
    // ============================================================================

    private handleEnterKey(isShiftKey: boolean): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        let range = selection.getRangeAt(0);

        // Delete any selected content first
        if (!range.collapsed) {
            this.deleteService.deleteContents(false);
            const newSelection = window.getSelection();
            if (!newSelection || newSelection.rangeCount === 0) return;
            range = newSelection.getRangeAt(0);
        }

        // Determine the mode to use
        let mode: EnterMode = isShiftKey ? EnterMode.ENTER_BR : EnterMode.ENTER_P;

        if (this.enterKeyService) {
            mode = isShiftKey
                ? this.enterKeyService.getShiftEnterMode()
                : this.enterKeyService.getEnterMode();
        }

        if (mode === EnterMode.ENTER_BR) {
            // Insert BR element - tracked as insertion
            this.handleBrInsertionWithTracking();
        } else {
            // Handle block splitting with track changes (P or DIV mode)
            this.handleBlockSplitWithTracking(mode);
        }
    }

    /**
     * Handle BR insertion with proper track changes support
     * This ensures the BR is properly wrapped in an insert node
     * and cursor is positioned correctly for continued typing
     */
    private handleBrInsertionWithTracking(): void {
        const br = document.createElement('br');
        this.insertService.insert({ nodes: [br] });
    }

    /**
     * Handle block splitting while maintaining track changes
     * Works for both ENTER_P and ENTER_DIV modes
     */
    private handleBlockSplitWithTracking(mode: EnterMode): void {
        const selection = window.getSelection();
        const editorEl = this.stateService.getEditorElement();
        if (!selection || selection.rangeCount === 0 || !editorEl) return;

        const range = selection.getRangeAt(0);
        const tagName = mode === EnterMode.ENTER_P ? 'p' : 'div';

        // Find closest block element
        const blockElement = this.domService.findClosestBlockElement(range.startContainer);

        if (blockElement && editorEl.contains(blockElement)) {
            this.splitBlockWithTracking(range, selection, blockElement, tagName);
        } else {
            this.createBlocksWithTracking(range, selection, tagName);
        }

        this.stateService.notifyContentChange();
    }

    /**
     * Split a block element while preserving track changes
     * 
     * KEY INSIGHT: When splitting a block that contains tracked changes,
     * the track change nodes should be preserved in their respective blocks.
     * The split itself is NOT tracked as a change - only the content modifications are.
     */
    private splitBlockWithTracking(
        range: Range,
        selection: Selection,
        blockElement: HTMLElement,
        tagName: string
    ): void {
        // Check if we're inside a track change node
        const currentInsertNode = this.nodeService.getCurrentUserIceNode(
            range.startContainer,
            CHANGE_TYPES.INSERT
        );

        if (currentInsertNode && this.nodeService.isCurrentUserIceNode(currentInsertNode)) {
            // We're inside an insert node - need special handling
            this.splitInsertNodeAtCursor(range, selection, blockElement, tagName, currentInsertNode);
            return;
        }

        // Standard block split - preserves existing track changes markup
        this.performStandardBlockSplit(range, selection, blockElement, tagName);
    }

    /**
     * Split an insert node at cursor position during block split
     * This handles the case where user is typing tracked content and presses Enter
     */
    private splitInsertNodeAtCursor(
        range: Range,
        selection: Selection,
        blockElement: HTMLElement,
        tagName: string,
        insertNode: IceNode
    ): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        // Get the change ID from the current insert node
        const changeId = insertNode.getAttribute(ICE_ATTRIBUTES.changeId);
        const userId = insertNode.getAttribute(ICE_ATTRIBUTES.userId);
        const userName = insertNode.getAttribute(ICE_ATTRIBUTES.userName);
        const sessionId = insertNode.getAttribute(ICE_ATTRIBUTES.sessionId);

        // Calculate offset within the insert node
        const offset = this.domService.getOffsetInNode(range, insertNode);
        const textContent = insertNode.textContent || '';
        const beforeText = textContent.substring(0, offset);
        const afterText = textContent.substring(offset);

        // Update the current insert node with content before cursor
        if (beforeText) {
            insertNode.textContent = beforeText;
        } else {
            // If no content before, we might need to add a placeholder
            insertNode.innerHTML = '<br>';
        }

        // Create range from cursor to end of block for extraction
        const endRange = document.createRange();

        // Set start after the insert node (we've already handled its content)
        endRange.setStartAfter(insertNode);

        if (blockElement.lastChild) {
            if (blockElement.lastChild.nodeType === Node.TEXT_NODE) {
                endRange.setEnd(blockElement.lastChild, (blockElement.lastChild as Text).length);
            } else {
                endRange.setEndAfter(blockElement.lastChild);
            }
        } else {
            endRange.setEnd(blockElement, blockElement.childNodes.length);
        }

        // Extract remaining content after the insert node
        const afterBlockContent = endRange.extractContents();

        // Create the new block
        const newBlock = document.createElement(tagName);

        // Create a new insert node for the content after cursor (if any)
        if (afterText) {
            const newInsertNode = this.nodeService.createIceNode(CHANGE_TYPES.INSERT, changeId || '');

            // Copy attributes from original insert node
            if (changeId) newInsertNode.setAttribute(ICE_ATTRIBUTES.changeId, changeId);
            if (userId) newInsertNode.setAttribute(ICE_ATTRIBUTES.userId, userId);
            if (userName) newInsertNode.setAttribute(ICE_ATTRIBUTES.userName, userName);
            if (sessionId) newInsertNode.setAttribute(ICE_ATTRIBUTES.sessionId, sessionId);

            newInsertNode.textContent = afterText;
            newBlock.appendChild(newInsertNode);

            // Add any remaining block content after the new insert node
            if (afterBlockContent.hasChildNodes()) {
                newBlock.appendChild(afterBlockContent);
            }
        } else {
            // No text after cursor in the insert node
            if (this.domService.fragmentHasVisibleContent(afterBlockContent)) {
                newBlock.appendChild(afterBlockContent);
            } else {
                // Empty new block - add BR for cursor positioning
                newBlock.appendChild(document.createElement('br'));
            }
        }

        // If original block is now empty after the insert node, ensure it has proper content
        if (!this.hasContentAfterNode(blockElement, insertNode)) {
            // Block has no content after insert node, which is fine
        }

        // Ensure the original block has visible content
        if (!this.domService.elementHasVisibleContent(blockElement)) {
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

        // Position cursor at start of new block (inside insert node if present)
        this.positionCursorInNewBlock(newBlock, selection);
    }

    /**
     * Check if block has content after a specific node
     */
    private hasContentAfterNode(block: HTMLElement, node: Node): boolean {
        let sibling = node.nextSibling;
        while (sibling) {
            if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent?.trim()) {
                return true;
            }
            if (sibling.nodeType === Node.ELEMENT_NODE) {
                const el = sibling as HTMLElement;
                if (el.tagName !== 'BR' && this.domService.elementHasVisibleContent(el)) {
                    return true;
                }
            }
            sibling = sibling.nextSibling;
        }
        return false;
    }

    /**
     * Position cursor in newly created block, handling insert nodes
     */
    private positionCursorInNewBlock(block: HTMLElement, selection: Selection): void {
        const editorEl = this.stateService.getEditorElement();
        editorEl?.focus();

        const newRange = document.createRange();
        const firstChild = block.firstChild;

        if (!firstChild) {
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        } else if (firstChild.nodeType === Node.ELEMENT_NODE) {
            const firstElement = firstChild as HTMLElement;

            // Check if first child is an insert node
            if (firstElement.classList.contains('ice-ins')) {
                // Position cursor at start of insert node content
                const textNode = this.domService.findFirstTextNodeIn(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else if (firstElement.firstChild) {
                    newRange.setStart(firstElement, 0);
                    newRange.setEnd(firstElement, 0);
                } else {
                    // Empty insert node - add placeholder
                    const placeholder = document.createTextNode('\u200B');
                    firstElement.appendChild(placeholder);
                    newRange.setStart(placeholder, 0);
                    newRange.setEnd(placeholder, 0);
                }
            } else if (firstElement.tagName === 'BR') {
                newRange.setStartBefore(firstElement);
                newRange.setEndBefore(firstElement);
            } else {
                const textNode = this.domService.findFirstTextNodeIn(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else {
                    newRange.setStart(block, 0);
                    newRange.setEnd(block, 0);
                }
            }
        } else if (firstChild.nodeType === Node.TEXT_NODE) {
            newRange.setStart(firstChild, 0);
            newRange.setEnd(firstChild, 0);
        } else {
            newRange.setStart(block, 0);
            newRange.setEnd(block, 0);
        }

        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    /**
     * Perform standard block split (when not inside an insert node)
     */
    private performStandardBlockSplit(
        range: Range,
        selection: Selection,
        blockElement: HTMLElement,
        tagName: string
    ): void {
        // Create range from cursor to end of block
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

        // Extract content after cursor - preserves track changes markup
        const afterContent = endRange.extractContents();

        // Create new block element
        const newBlock = document.createElement(tagName);
        const hasContent = this.domService.fragmentHasVisibleContent(afterContent);

        if (hasContent) {
            newBlock.appendChild(afterContent);
        } else {
            newBlock.appendChild(document.createElement('br'));
        }

        // If original block is now empty, add BR
        if (!this.domService.elementHasVisibleContent(blockElement)) {
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

        // Position cursor at start of new block
        this.domService.positionCursorAtBlockStart(newBlock, selection);
    }

    /**
     * Create new blocks when cursor is not inside a block
     */
    private createBlocksWithTracking(
        range: Range,
        selection: Selection,
        tagName: string
    ): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        // Check if we're inside an insert node
        const currentInsertNode = this.nodeService.getCurrentUserIceNode(
            range.startContainer,
            CHANGE_TYPES.INSERT
        );

        if (currentInsertNode && this.nodeService.isCurrentUserIceNode(currentInsertNode)) {
            // Handle insert node split at root level
            this.createBlocksWithInsertNodeSplit(range, selection, tagName, currentInsertNode, editorEl);
            return;
        }

        // Standard block creation
        this.performStandardBlockCreation(range, selection, tagName, editorEl);
    }

    /**
     * Create blocks while splitting an insert node at root level
     */
    private createBlocksWithInsertNodeSplit(
        range: Range,
        selection: Selection,
        tagName: string,
        insertNode: IceNode,
        editorEl: HTMLElement
    ): void {
        // Similar logic to splitInsertNodeAtCursor but for root-level content
        const changeId = insertNode.getAttribute(ICE_ATTRIBUTES.changeId);
        const userId = insertNode.getAttribute(ICE_ATTRIBUTES.userId);
        const userName = insertNode.getAttribute(ICE_ATTRIBUTES.userName);
        const sessionId = insertNode.getAttribute(ICE_ATTRIBUTES.sessionId);

        const offset = this.domService.getOffsetInNode(range, insertNode);
        const textContent = insertNode.textContent || '';
        const beforeText = textContent.substring(0, offset);
        const afterText = textContent.substring(offset);

        // Get content before and after the insert node
        const beforeRange = document.createRange();
        beforeRange.setStart(editorEl, 0);
        beforeRange.setEndBefore(insertNode);

        const afterRange = document.createRange();
        afterRange.setStartAfter(insertNode);
        afterRange.setEnd(editorEl, editorEl.childNodes.length);

        const beforeContent = beforeRange.extractContents();
        const afterContent = afterRange.extractContents();

        // Remove the insert node from DOM (we'll recreate it in blocks)
        insertNode.parentNode?.removeChild(insertNode);

        // Clear editor
        editorEl.innerHTML = '';

        // Create first block
        const firstBlock = document.createElement(tagName);
        if (this.domService.fragmentHasVisibleContent(beforeContent)) {
            firstBlock.appendChild(beforeContent);
        }

        // Add the before-cursor insert content
        if (beforeText) {
            const firstInsertNode = this.nodeService.createIceNode(CHANGE_TYPES.INSERT, changeId || '');
            if (changeId) firstInsertNode.setAttribute(ICE_ATTRIBUTES.changeId, changeId);
            if (userId) firstInsertNode.setAttribute(ICE_ATTRIBUTES.userId, userId);
            if (userName) firstInsertNode.setAttribute(ICE_ATTRIBUTES.userName, userName);
            if (sessionId) firstInsertNode.setAttribute(ICE_ATTRIBUTES.sessionId, sessionId);
            firstInsertNode.textContent = beforeText;
            firstBlock.appendChild(firstInsertNode);
        }

        if (!firstBlock.hasChildNodes()) {
            firstBlock.appendChild(document.createElement('br'));
        }

        // Create second block
        const secondBlock = document.createElement(tagName);

        // Add the after-cursor insert content
        if (afterText) {
            const secondInsertNode = this.nodeService.createIceNode(CHANGE_TYPES.INSERT, changeId || '');
            if (changeId) secondInsertNode.setAttribute(ICE_ATTRIBUTES.changeId, changeId);
            if (userId) secondInsertNode.setAttribute(ICE_ATTRIBUTES.userId, userId);
            if (userName) secondInsertNode.setAttribute(ICE_ATTRIBUTES.userName, userName);
            if (sessionId) secondInsertNode.setAttribute(ICE_ATTRIBUTES.sessionId, sessionId);
            secondInsertNode.textContent = afterText;
            secondBlock.appendChild(secondInsertNode);
        }

        if (this.domService.fragmentHasVisibleContent(afterContent)) {
            secondBlock.appendChild(afterContent);
        }

        if (!secondBlock.hasChildNodes()) {
            secondBlock.appendChild(document.createElement('br'));
        }

        // Append blocks
        editorEl.appendChild(firstBlock);
        editorEl.appendChild(secondBlock);

        // Position cursor at start of second block
        this.positionCursorInNewBlock(secondBlock, selection);
    }

    /**
     * Standard block creation without insert node handling
     */
    private performStandardBlockCreation(
        range: Range,
        selection: Selection,
        tagName: string,
        editorEl: HTMLElement
    ): void {
        // Create ranges for before and after cursor
        const beforeRange = document.createRange();
        beforeRange.setStart(editorEl, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const afterRange = document.createRange();
        afterRange.setStart(range.startContainer, range.startOffset);
        afterRange.setEnd(editorEl, editorEl.childNodes.length);

        // Extract content
        const afterContent = afterRange.extractContents();
        const beforeContent = beforeRange.extractContents();

        // Clear editor
        editorEl.innerHTML = '';

        // Create first block
        const firstBlock = document.createElement(tagName);
        if (this.domService.fragmentHasVisibleContent(beforeContent)) {
            firstBlock.appendChild(beforeContent);
        } else {
            firstBlock.appendChild(document.createElement('br'));
        }

        // Create second block
        const secondBlock = document.createElement(tagName);
        if (this.domService.fragmentHasVisibleContent(afterContent)) {
            secondBlock.appendChild(afterContent);
        } else {
            secondBlock.appendChild(document.createElement('br'));
        }

        // Append blocks
        editorEl.appendChild(firstBlock);
        editorEl.appendChild(secondBlock);

        // Position cursor at start of second block
        this.domService.positionCursorAtBlockStart(secondBlock, selection);
    }
}