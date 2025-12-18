import { Injectable } from '@angular/core';
import { TrackChangesStateService } from './track-changes-state.service';
import { TrackChangesInsertService } from './track-changes-insert.service';
import { TrackChangesDeleteService } from './track-changes-delete.service';
import { TrackChangesDomService } from './track-changes-dom.service';
import { TrackChangesNodeService } from './track-changes-node.service';
import { EnterKeyService } from '../enter-key.service';
import { EnterMode } from '../../entities/editor-config';
import { ICE_ATTRIBUTES, CHANGE_TYPES, IceNode, ICE_CLASSES } from './track-changes.constants';

/**
 * Handles all event listeners for track changes.
 * Manages keyboard, input, paste, cut, and composition events.
 * 
 * FIXED: Now properly handles Enter key inside list items (UL/OL)
 * by creating new LI elements with proper track changes support.
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

        editorEl.addEventListener('keydown', this.listeners['keydown'], true);

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

        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            const formattingKeys = ['b', 'i', 'u', 'z', 'y'];
            if (formattingKeys.includes(key)) return;
        }

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

        const formattingTypes = [
            'formatBold', 'formatItalic', 'formatUnderline',
            'formatStrikethrough', 'formatSubscript', 'formatSuperscript'
        ];
        if (formattingTypes.includes(inputType)) return;

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

        if (inputType === 'insertParagraph') {
            event.preventDefault();
            this.handleEnterKey(false);
            return;
        }

        if (inputType === 'insertLineBreak') {
            event.preventDefault();
            this.handleEnterKey(true);
            return;
        }

        if (inputType === 'deleteContentBackward') {
            event.preventDefault();
            this.deleteService.deleteContents(false);
            return;
        }

        if (inputType === 'deleteContentForward') {
            event.preventDefault();
            this.deleteService.deleteContents(true);
            return;
        }

        if (inputType === 'deleteWordBackward') {
            event.preventDefault();
            this.deleteService.deleteContents(false, true);
            return;
        }

        if (inputType === 'deleteWordForward') {
            event.preventDefault();
            this.deleteService.deleteContents(true, true);
            return;
        }
    }

    private handleCompositionEnd(event: CompositionEvent): void {
        this.isComposing = false;
        if (!this.stateService.isEnabled()) return;

        const data = event.data;
        if (data) {
            this.insertService.insert(
                { text: data },
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

        const selectedText = range.toString();
        event.clipboardData?.setData('text/plain', selectedText);
        event.preventDefault();

        this.deleteService.deleteSelection(range);
    }

    // ============================================================================
    // ENTER KEY HANDLING - FIXED FOR LISTS
    // ============================================================================

    private handleEnterKey(isShiftKey: boolean): void {
        const selection = window.getSelection();
        const editorEl = this.stateService.getEditorElement();
        if (!selection || selection.rangeCount === 0 || !editorEl) return;

        const range = selection.getRangeAt(0);

        // Delete any selected content first
        if (!range.collapsed) {
            this.deleteService.deleteSelection(range);
        }

        // CRITICAL: Check if we're inside a list item FIRST
        const listItem = this.findClosestListItem(range.startContainer);
        if (listItem) {
            this.splitListItemWithTracking(range, selection, listItem);
            this.stateService.notifyContentChange();
            return;
        }

        // Determine enter mode
        let mode: EnterMode = isShiftKey ? EnterMode.ENTER_BR : EnterMode.ENTER_P;

        if (this.enterKeyService) {
            mode = isShiftKey
                ? this.enterKeyService.getShiftEnterMode()
                : this.enterKeyService.getEnterMode();
        }

        if (mode === EnterMode.ENTER_BR) {
            this.handleBrInsertionWithTracking();
        } else {
            this.handleBlockSplitWithTracking(mode);
        }
    }

    /**
     * Find closest LI ancestor element
     */
    private findClosestListItem(node: Node): HTMLElement | null {
        const editorEl = this.stateService.getEditorElement();
        let current: Node | null = node;

        while (current && current !== editorEl) {
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
     * Split a list item with track changes support
     * Creates a new LI element and wraps new content in track change nodes when needed
     */
    private splitListItemWithTracking(
        range: Range,
        selection: Selection,
        listItem: HTMLElement
    ): void {
        const parentList = listItem.parentElement;
        if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) {
            return;
        }

        // Check if we're inside a track change insert node
        const currentInsertNode = this.nodeService.getCurrentUserIceNode(
            range.startContainer,
            CHANGE_TYPES.INSERT
        );

        if (currentInsertNode && this.nodeService.isCurrentUserIceNode(currentInsertNode)) {
            // We're inside an insert node - split it
            this.splitListItemWithInsertNode(
                range, selection, listItem, parentList, currentInsertNode
            );
            return;
        }

        // Standard list item split - new LI will have content tracked if needed
        this.performStandardListItemSplit(range, selection, listItem, parentList);
    }

    /**
     * Split list item when cursor is inside a tracked insert node
     */
    private splitListItemWithInsertNode(
        range: Range,
        selection: Selection,
        listItem: HTMLElement,
        parentList: HTMLElement,
        insertNode: IceNode
    ): void {
        // Get attributes from current insert node to continue tracking
        const changeId = insertNode.getAttribute(ICE_ATTRIBUTES.changeId);
        const userId = insertNode.getAttribute(ICE_ATTRIBUTES.userId);
        const userName = insertNode.getAttribute(ICE_ATTRIBUTES.userName);
        const sessionId = insertNode.getAttribute(ICE_ATTRIBUTES.sessionId);
        const time = insertNode.getAttribute(ICE_ATTRIBUTES.time);

        // Calculate offset within the insert node
        const offset = this.domService.getOffsetInNode(range, insertNode);
        const textContent = insertNode.textContent || '';
        const beforeText = textContent.substring(0, offset);
        const afterText = textContent.substring(offset);

        // Update current insert node with content before cursor
        if (beforeText) {
            insertNode.textContent = beforeText;
        } else {
            insertNode.innerHTML = '<br>';
        }

        // Create new list item
        const newListItem = document.createElement('li');

        // Check if there's content after the insert node in the current LI
        const hasContentAfterInsert = this.hasContentAfterNode(listItem, insertNode);

        if (afterText || !hasContentAfterInsert) {
            // Create new insert node for the new LI
            const newInsertNode = this.nodeService.createIceNode(
                CHANGE_TYPES.INSERT,
                changeId || undefined
            );

            // Copy attributes
            if (userId) newInsertNode.setAttribute(ICE_ATTRIBUTES.userId, userId);
            if (userName) newInsertNode.setAttribute(ICE_ATTRIBUTES.userName, userName);
            if (sessionId) newInsertNode.setAttribute(ICE_ATTRIBUTES.sessionId, sessionId);
            if (time) newInsertNode.setAttribute(ICE_ATTRIBUTES.time, time);
            newInsertNode.setAttribute(ICE_ATTRIBUTES.lastTime, Date.now().toString());

            if (afterText) {
                newInsertNode.textContent = afterText;
            }

            newListItem.appendChild(newInsertNode);

            // Move any content after the original insert node to the new LI
            if (hasContentAfterInsert) {
                let sibling = insertNode.nextSibling;
                while (sibling) {
                    const next = sibling.nextSibling;
                    newListItem.appendChild(sibling);
                    sibling = next;
                }
            }

            if (!newListItem.textContent?.trim() && !newListItem.querySelector('br')) {
                newListItem.appendChild(document.createElement('br'));
            }
        } else {
            // Move remaining content to new LI
            let sibling = insertNode.nextSibling;
            while (sibling) {
                const next = sibling.nextSibling;
                newListItem.appendChild(sibling);
                sibling = next;
            }

            if (!newListItem.hasChildNodes()) {
                newListItem.appendChild(document.createElement('br'));
            }
        }

        // Ensure original LI has content
        if (!this.domService.elementHasVisibleContent(listItem)) {
            while (listItem.firstChild && listItem.firstChild !== insertNode) {
                listItem.removeChild(listItem.firstChild);
            }
            if (!listItem.querySelector('br') && !listItem.textContent?.trim()) {
                listItem.appendChild(document.createElement('br'));
            }
        }

        // Insert new LI after current one
        if (listItem.nextSibling) {
            parentList.insertBefore(newListItem, listItem.nextSibling);
        } else {
            parentList.appendChild(newListItem);
        }

        // Position cursor in new list item
        this.positionCursorInListItem(newListItem, selection);
    }

    /**
     * Standard list item split (not inside an insert node)
     * The new LI content will be wrapped in a track change insert node
     */
    private performStandardListItemSplit(
        range: Range,
        selection: Selection,
        listItem: HTMLElement,
        parentList: HTMLElement
    ): void {
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

        // Create a tracked insert node for the new list item
        const changeId = this.stateService.getNewChangeId();
        const insertNode = this.nodeService.createIceNode(CHANGE_TYPES.INSERT, changeId);

        // Add content to insert node
        if (afterContent.childNodes.length > 0 &&
            this.domService.fragmentHasVisibleContent(afterContent)) {
            // Move content into insert node
            insertNode.appendChild(afterContent);
        }

        // Add BR for cursor positioning if insert node is empty
        if (!insertNode.textContent?.trim() && !insertNode.querySelector('br')) {
            insertNode.appendChild(document.createElement('br'));
        }

        newListItem.appendChild(insertNode);

        // Ensure original list item has content
        if (!this.domService.elementHasVisibleContent(listItem)) {
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

        // Position cursor at start of new list item (inside the insert node)
        this.positionCursorInListItem(newListItem, selection);
    }

    /**
     * Check if there's content after a specific node within an element
     */
    private hasContentAfterNode(container: HTMLElement, node: Node): boolean {
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
     * Position cursor in a list item, preferring inside insert nodes
     */
    private positionCursorInListItem(listItem: HTMLElement, selection: Selection): void {
        const editorEl = this.stateService.getEditorElement();
        editorEl?.focus();

        const newRange = document.createRange();
        const firstChild = listItem.firstChild;

        if (!firstChild) {
            newRange.setStart(listItem, 0);
            newRange.setEnd(listItem, 0);
        } else if (firstChild.nodeType === Node.ELEMENT_NODE) {
            const firstElement = firstChild as HTMLElement;

            // Check if first child is an insert node
            if (firstElement.classList.contains(ICE_CLASSES.insert)) {
                const textNode = this.domService.findFirstTextNodeIn(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else if (firstElement.firstChild?.nodeType === Node.ELEMENT_NODE &&
                    (firstElement.firstChild as HTMLElement).tagName === 'BR') {
                    newRange.setStartBefore(firstElement.firstChild);
                    newRange.setEndBefore(firstElement.firstChild);
                } else {
                    newRange.setStart(firstElement, 0);
                    newRange.setEnd(firstElement, 0);
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
                    newRange.setStart(listItem, 0);
                    newRange.setEnd(listItem, 0);
                }
            }
        } else if (firstChild.nodeType === Node.TEXT_NODE) {
            newRange.setStart(firstChild, 0);
            newRange.setEnd(firstChild, 0);
        } else {
            newRange.setStart(listItem, 0);
            newRange.setEnd(listItem, 0);
        }

        selection.removeAllRanges();
        selection.addRange(newRange);

        // Verify cursor position
        setTimeout(() => {
            const currentSel = window.getSelection();
            if (!currentSel || currentSel.rangeCount === 0) return;
            const currentRange = currentSel.getRangeAt(0);
            if (!listItem.contains(currentRange.startContainer)) {
                currentSel.removeAllRanges();
                currentSel.addRange(newRange);
            }
        }, 0);
    }

    // ============================================================================
    // STANDARD BLOCK HANDLING (FOR NON-LIST CONTEXTS)
    // ============================================================================

    private handleBrInsertionWithTracking(): void {
        const br = document.createElement('br');
        this.insertService.insert({ nodes: [br] });
    }

    private handleBlockSplitWithTracking(mode: EnterMode): void {
        const selection = window.getSelection();
        const editorEl = this.stateService.getEditorElement();
        if (!selection || selection.rangeCount === 0 || !editorEl) return;

        const range = selection.getRangeAt(0);
        const tagName = mode === EnterMode.ENTER_P ? 'p' : 'div';

        const blockElement = this.domService.findClosestBlockElement(range.startContainer);

        if (blockElement && editorEl.contains(blockElement)) {
            this.splitBlockWithTracking(range, selection, blockElement, tagName);
        } else {
            this.createBlocksWithTracking(range, selection, tagName);
        }

        this.stateService.notifyContentChange();
    }

    private splitBlockWithTracking(
        range: Range,
        selection: Selection,
        blockElement: HTMLElement,
        tagName: string
    ): void {
        const currentInsertNode = this.nodeService.getCurrentUserIceNode(
            range.startContainer,
            CHANGE_TYPES.INSERT
        );

        if (currentInsertNode && this.nodeService.isCurrentUserIceNode(currentInsertNode)) {
            this.splitInsertNodeAtCursor(range, selection, blockElement, tagName, currentInsertNode);
            return;
        }

        this.performStandardBlockSplit(range, selection, blockElement, tagName);
    }

    private splitInsertNodeAtCursor(
        range: Range,
        selection: Selection,
        blockElement: HTMLElement,
        tagName: string,
        insertNode: IceNode
    ): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        const changeId = insertNode.getAttribute(ICE_ATTRIBUTES.changeId);
        const userId = insertNode.getAttribute(ICE_ATTRIBUTES.userId);
        const userName = insertNode.getAttribute(ICE_ATTRIBUTES.userName);
        const sessionId = insertNode.getAttribute(ICE_ATTRIBUTES.sessionId);

        const offset = this.domService.getOffsetInNode(range, insertNode);
        const textContent = insertNode.textContent || '';
        const beforeText = textContent.substring(0, offset);
        const afterText = textContent.substring(offset);

        if (beforeText) {
            insertNode.textContent = beforeText;
        } else {
            insertNode.innerHTML = '<br>';
        }

        const endRange = document.createRange();
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

        const afterContent = endRange.extractContents();
        const newBlock = document.createElement(tagName);
        const newInsertNode = this.nodeService.createIceNode(CHANGE_TYPES.INSERT, changeId || undefined);

        if (userId) newInsertNode.setAttribute(ICE_ATTRIBUTES.userId, userId);
        if (userName) newInsertNode.setAttribute(ICE_ATTRIBUTES.userName, userName);
        if (sessionId) newInsertNode.setAttribute(ICE_ATTRIBUTES.sessionId, sessionId);
        newInsertNode.setAttribute(ICE_ATTRIBUTES.lastTime, Date.now().toString());

        if (afterText) {
            newInsertNode.textContent = afterText;
            newBlock.appendChild(newInsertNode);
        }

        if (afterContent.childNodes.length > 0) {
            if (afterText) {
                while (afterContent.firstChild) {
                    newBlock.appendChild(afterContent.firstChild);
                }
            } else {
                newBlock.appendChild(afterContent);
            }
        }

        if (!newBlock.hasChildNodes() || !this.domService.elementHasVisibleContent(newBlock)) {
            if (!afterText) {
                newBlock.appendChild(newInsertNode);
            }
            if (!newInsertNode.hasChildNodes()) {
                newInsertNode.appendChild(document.createElement('br'));
            }
        }

        if (!this.domService.elementHasVisibleContent(blockElement)) {
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

        this.positionCursorInNewBlock(newBlock, selection);
    }

    private performStandardBlockSplit(
        range: Range,
        selection: Selection,
        blockElement: HTMLElement,
        tagName: string
    ): void {
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
        const hasContent = this.domService.fragmentHasVisibleContent(afterContent);

        if (hasContent) {
            newBlock.appendChild(afterContent);
        } else {
            newBlock.appendChild(document.createElement('br'));
        }

        if (!this.domService.elementHasVisibleContent(blockElement)) {
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

        this.domService.positionCursorAtBlockStart(newBlock, selection);
    }

    private createBlocksWithTracking(
        range: Range,
        selection: Selection,
        tagName: string
    ): void {
        const editorEl = this.stateService.getEditorElement();
        if (!editorEl) return;

        const currentInsertNode = this.nodeService.getCurrentUserIceNode(
            range.startContainer,
            CHANGE_TYPES.INSERT
        );

        if (currentInsertNode && this.nodeService.isCurrentUserIceNode(currentInsertNode)) {
            this.createBlocksWithInsertNodeSplit(range, selection, tagName, currentInsertNode, editorEl);
            return;
        }

        this.performStandardBlockCreation(range, selection, tagName, editorEl);
    }

    private createBlocksWithInsertNodeSplit(
        range: Range,
        selection: Selection,
        tagName: string,
        insertNode: IceNode,
        editorEl: HTMLElement
    ): void {
        const changeId = insertNode.getAttribute(ICE_ATTRIBUTES.changeId);
        const userId = insertNode.getAttribute(ICE_ATTRIBUTES.userId);
        const userName = insertNode.getAttribute(ICE_ATTRIBUTES.userName);
        const sessionId = insertNode.getAttribute(ICE_ATTRIBUTES.sessionId);

        const offset = this.domService.getOffsetInNode(range, insertNode);
        const textContent = insertNode.textContent || '';
        const beforeText = textContent.substring(0, offset);
        const afterText = textContent.substring(offset);

        if (beforeText) {
            insertNode.textContent = beforeText;
        } else {
            insertNode.innerHTML = '<br>';
        }

        const beforeRange = document.createRange();
        beforeRange.setStart(editorEl, 0);
        beforeRange.setEndAfter(insertNode);
        const beforeContent = beforeRange.extractContents();

        const afterRange = document.createRange();
        afterRange.setStart(editorEl, 0);
        if (editorEl.lastChild) {
            afterRange.setEndAfter(editorEl.lastChild);
        }
        const afterContent = afterRange.extractContents();

        while (editorEl.firstChild) {
            editorEl.removeChild(editorEl.firstChild);
        }

        const firstBlock = document.createElement(tagName);
        firstBlock.appendChild(beforeContent);
        editorEl.appendChild(firstBlock);

        const secondBlock = document.createElement(tagName);
        const newInsertNode = this.nodeService.createIceNode(CHANGE_TYPES.INSERT, changeId || undefined);

        if (userId) newInsertNode.setAttribute(ICE_ATTRIBUTES.userId, userId);
        if (userName) newInsertNode.setAttribute(ICE_ATTRIBUTES.userName, userName);
        if (sessionId) newInsertNode.setAttribute(ICE_ATTRIBUTES.sessionId, sessionId);
        newInsertNode.setAttribute(ICE_ATTRIBUTES.lastTime, Date.now().toString());

        if (afterText) {
            newInsertNode.textContent = afterText;
        }

        secondBlock.appendChild(newInsertNode);

        if (afterContent.childNodes.length > 0) {
            while (afterContent.firstChild) {
                secondBlock.appendChild(afterContent.firstChild);
            }
        }

        if (!newInsertNode.textContent?.trim()) {
            newInsertNode.appendChild(document.createElement('br'));
        }

        editorEl.appendChild(secondBlock);
        this.positionCursorInNewBlock(secondBlock, selection);
    }

    private performStandardBlockCreation(
        range: Range,
        selection: Selection,
        tagName: string,
        editorEl: HTMLElement
    ): void {
        const beforeRange = document.createRange();
        beforeRange.setStart(editorEl, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const afterRange = document.createRange();
        afterRange.setStart(range.startContainer, range.startOffset);
        if (editorEl.lastChild) {
            afterRange.setEndAfter(editorEl.lastChild);
        }

        const beforeContent = beforeRange.extractContents();
        const afterContent = afterRange.extractContents();

        while (editorEl.firstChild) {
            editorEl.removeChild(editorEl.firstChild);
        }

        const firstBlock = document.createElement(tagName);
        if (beforeContent.childNodes.length > 0 && this.domService.fragmentHasVisibleContent(beforeContent)) {
            firstBlock.appendChild(beforeContent);
        } else {
            firstBlock.appendChild(document.createElement('br'));
        }

        const secondBlock = document.createElement(tagName);
        if (afterContent.childNodes.length > 0 && this.domService.fragmentHasVisibleContent(afterContent)) {
            secondBlock.appendChild(afterContent);
        } else {
            secondBlock.appendChild(document.createElement('br'));
        }

        editorEl.appendChild(firstBlock);
        editorEl.appendChild(secondBlock);

        this.domService.positionCursorAtBlockStart(secondBlock, selection);
    }

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

            if (firstElement.classList.contains(ICE_CLASSES.insert)) {
                const textNode = this.domService.findFirstTextNodeIn(firstElement);
                if (textNode) {
                    newRange.setStart(textNode, 0);
                    newRange.setEnd(textNode, 0);
                } else if (firstElement.firstChild) {
                    newRange.setStart(firstElement, 0);
                    newRange.setEnd(firstElement, 0);
                } else {
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
}