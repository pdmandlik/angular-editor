import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TrackChangesState, ChangeRecord, EditorOutputMode } from '../entities/editor-config';

interface IceNode extends HTMLElement {
  _iceNodeId?: string;
}

interface BatchChange {
  id: string;
  type: 'insert' | 'delete';
  startTime: number;
  nodes: IceNode[];
}

@Injectable({
  providedIn: 'root'
})
export class TrackChangesService {
  // Constants matching ICE.js
  private readonly INSERT_TYPE = 'insertType';
  private readonly DELETE_TYPE = 'deleteType';

  // Attributes for tracking nodes - matching LITE/ICE.js standards
  private readonly attributes = {
    changeId: 'data-cid',
    userId: 'data-userid',
    userName: 'data-username',
    sessionId: 'data-session-id',
    time: 'data-time',
    lastTime: 'data-last-change-time',
    changeData: 'data-changedata'
  };

  // Class names for visual styling - matching LITE constants
  private readonly classes = {
    insert: 'ice-ins',
    delete: 'ice-del'
  };

  // Style prefix for user-specific styles
  private readonly stylePrefix = 'ice-cts';

  // State management
  private state$ = new BehaviorSubject<TrackChangesState>({
    isEnabled: false,
    isVisible: true,
    changes: [],
    pendingCount: 0
  });

  private editorElement: HTMLElement | null = null;
  private currentUser = { id: 'user1', name: 'Current User' };
  private sessionId: string = '';

  // Batch change tracking - core of ICE.js approach
  private batchChangeId: string | null = null;
  private batchChangeTimer: any = null;
  private readonly BATCH_TIMEOUT = 1000;

  // Change tracking
  private changes: { [id: string]: ChangeRecord } = {};
  private uniqueIdIndex = 1;

  // Event listeners
  private listeners: { [key: string]: EventListener } = {};

  // Track if we're in composition mode (for IME)
  private isComposing = false;

  // Selection management
  private lastSelection: Range | null = null;

  // Callback for history manager integration
  private onContentChangeCallback: (() => void) | null = null;

  constructor() {
    this.generateSessionId();
  }

  private generateSessionId(): void {
    const now = new Date();
    this.sessionId = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${now.getTime()}`;
  }

  // Register content change callback for undo/redo integration
  setContentChangeCallback(callback: () => void): void {
    this.onContentChangeCallback = callback;
  }

  // Notify that content has changed
  private notifyContentChange(): void {
    if (this.onContentChangeCallback) {
      this.onContentChangeCallback();
    }
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  getState(): Observable<TrackChangesState> {
    return this.state$.asObservable();
  }

  getCurrentState(): TrackChangesState {
    return this.state$.value;
  }

  setCurrentUser(user: { id: string; name: string }): void {
    this.currentUser = user;
    if (this.editorElement) {
      const userNodes = this.editorElement.querySelectorAll(
        `[${this.attributes.userId}="${user.id}"]`
      );
      userNodes.forEach(node => {
        node.setAttribute(this.attributes.userName, user.name);
      });
    }
  }

  getChanges(): { [id: string]: ChangeRecord } {
    return { ...this.changes };
  }

  countChanges(): number {
    return Object.values(this.changes).filter(c => !c.isAccepted && !c.isRejected).length;
  }

  isTracking(): boolean {
    return this.state$.value.isEnabled;
  }

  isVisible(): boolean {
    return this.state$.value.isVisible;
  }

  currentChangeNode(): IceNode | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    return this.getIceNodeAtRange(range);
  }

  isInsideChange(): boolean {
    return this.currentChangeNode() !== null;
  }

  startNewSession(): void {
    this.endBatchChange();
    this.generateSessionId();
  }

  enableTracking(element: HTMLElement): void {
    if (this.state$.value.isEnabled) return;

    this.editorElement = element;
    this.attachEventListeners();
    this.initializeExistingContent();

    this.state$.next({
      ...this.state$.value,
      isEnabled: true,
      isVisible: true
    });
  }

  disableTracking(): void {
    if (!this.state$.value.isEnabled) return;

    this.endBatchChange();
    this.detachEventListeners();
    this.editorElement = null;

    this.state$.next({
      ...this.state$.value,
      isEnabled: false
    });
  }

  toggleShowChanges(visible: boolean): void {
    const state = this.state$.value;

    if (this.editorElement) {
      const iceNodes = this.editorElement.querySelectorAll(`.${this.classes.insert}, .${this.classes.delete}`);
      iceNodes.forEach((node: Element) => {
        const element = node as HTMLElement;
        if (visible) {
          element.style.removeProperty('display');
        } else if (element.classList.contains(this.classes.delete)) {
          element.style.display = 'none';
        }
      });
    }

    this.state$.next({
      ...state,
      isVisible: visible
    });
  }

  // ============================================================================
  // BATCH CHANGE MANAGEMENT
  // ============================================================================

  private startBatchChange(): string | null {
    if (this.batchChangeId) {
      this.resetBatchTimer();
      return null;
    }

    this.batchChangeId = this.getNewChangeId();
    this.resetBatchTimer();
    return this.batchChangeId;
  }

  private endBatchChange(changeId?: string): void {
    if (changeId && changeId !== this.batchChangeId) {
      return;
    }

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

  private getNewChangeId(): string {
    const id = this.uniqueIdIndex++;
    if (this.changes[id]) {
      return this.getNewChangeId();
    }
    return String(id);
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  private attachEventListeners(): void {
    if (!this.editorElement) return;

    this.listeners['keydown'] = (e: Event) => this.handleKeydown(e as KeyboardEvent);
    this.listeners['beforeinput'] = (e: Event) => this.handleBeforeInput(e as InputEvent);
    this.listeners['compositionstart'] = () => { this.isComposing = true; };
    this.listeners['compositionend'] = (e: Event) => this.handleCompositionEnd(e as CompositionEvent);
    this.listeners['paste'] = (e: Event) => this.handlePaste(e as ClipboardEvent);
    this.listeners['cut'] = (e: Event) => this.handleCut(e as ClipboardEvent);

    this.editorElement.addEventListener('keydown', this.listeners['keydown'], true);

    Object.keys(this.listeners).forEach(event => {
      if (event !== 'keydown') {
        this.editorElement!.addEventListener(event, this.listeners[event], true);
      }
    });
  }

  private detachEventListeners(): void {
    if (!this.editorElement) return;

    Object.keys(this.listeners).forEach(event => {
      this.editorElement!.removeEventListener(event, this.listeners[event], true);
    });

    this.listeners = {};
  }

  private handleBeforeInput(event: InputEvent): void {
    if (!this.state$.value.isEnabled || this.isComposing) return;

    const inputType = event.inputType;

    // Don't prevent default for formatting commands
    if (inputType === 'formatBold' ||
      inputType === 'formatItalic' ||
      inputType === 'formatUnderline' ||
      inputType === 'formatStrikeThrough' ||
      inputType === 'formatSubscript' ||
      inputType === 'formatSuperscript') {
      return;
    }

    if (inputType === 'insertText' || inputType === 'insertCompositionText') {
      if (!this.isComposing) {
        event.preventDefault();
        this.insert({ text: event.data || '' });
      }
    } else if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
      event.preventDefault();
      const br = document.createElement('br');
      this.insert({ nodes: [br] });
    } else if (inputType.startsWith('delete')) {
      event.preventDefault();
      const isForward = inputType.includes('Forward');
      const isWord = inputType.includes('Word');
      this.deleteContents(isForward, isWord);
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.state$.value.isEnabled || this.isComposing) return;

    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      const formattingKeys = ['b', 'i', 'u', 'z', 'y'];

      if (formattingKeys.includes(key)) {
        return;
      }
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (!('InputEvent' in window)) {
        event.preventDefault();
        this.deleteContents(event.key === 'Delete');
      }
    }
  }

  private handleCompositionEnd(event: CompositionEvent): void {
    this.isComposing = false;
    if (event.data) {
      this.insert({ text: event.data });
    }
  }

  private handlePaste(event: ClipboardEvent): void {
    if (!this.state$.value.isEnabled) return;

    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text) {
      this.insert({ text });
    }
  }

  private handleCut(event: ClipboardEvent): void {
    if (!this.state$.value.isEnabled) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    event.preventDefault();
    const text = range.toString();
    event.clipboardData?.setData('text/plain', text);
    this.deleteContents(false);
  }

  // ============================================================================
  // INSERT LOGIC - FIXED TO MERGE ADJACENT NODES
  // ============================================================================

  private insert(options: { text?: string; nodes?: Node[] }): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let range = selection.getRangeAt(0);

    // Handle selection deletion first
    if (!range.collapsed) {
      this.deleteSelection(range);
      range = selection.getRangeAt(0);
    }

    // Get or create a batch change ID
    const changeId = this.startBatchChange() || this.batchChangeId || this.getNewChangeId();

    // CASE 1: Check if cursor is already inside a current user's insert node
    const currentInsertNode = this.getCurrentUserIceNode(range.startContainer, this.INSERT_TYPE);

    if (currentInsertNode && this.isCurrentUserIceNode(currentInsertNode)) {
      this.insertIntoExistingNode(currentInsertNode, range, selection, options);
      return;
    }

    // CASE 2: Check for adjacent insert node (cursor right after <ins>...</ins>)
    // This is the KEY FIX for the "12345" creating 5 separate tags issue
    const adjacentInsertNode = this.getAdjacentCurrentUserInsertNode(range);

    if (adjacentInsertNode) {
      this.appendToAdjacentNode(adjacentInsertNode, range, selection, options);
      return;
    }

    // CASE 3: Create new insert node
    this.createNewInsertNode(changeId, range, selection, options);
  }

  /**
   * Insert content into an existing insert node that the cursor is already inside.
   * For block elements like BR, we need to handle cursor positioning carefully.
   */
  private insertIntoExistingNode(
    insertNode: IceNode,
    range: Range,
    selection: Selection,
    options: { text?: string; nodes?: Node[] }
  ): void {
    const existingChangeId = insertNode.getAttribute(this.attributes.changeId);
    if (!existingChangeId) return;

    this.updateChangeTime(existingChangeId);

    if (options.text) {
      const offset = this.getOffsetInNode(range, insertNode);
      const textContent = insertNode.textContent || '';

      insertNode.textContent =
        textContent.substring(0, offset) +
        options.text +
        textContent.substring(offset);

      // Position cursor INSIDE the insert node at the new position
      const newOffset = offset + options.text.length;
      const textNode = insertNode.firstChild;

      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, newOffset);
        range.setEnd(textNode, newOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else if (options.nodes && options.nodes.length > 0) {
      // Check if we're inserting block elements like BR
      const hasBlockElement = options.nodes.some(node =>
        node.nodeType === Node.ELEMENT_NODE &&
        this.isBlockOrBreakElement(node as HTMLElement)
      );

      if (hasBlockElement) {
        // For BR insertion inside an existing insert node:
        // Insert the BR at the current position, then move cursor AFTER the insert node
        // This ensures the next typed text creates a new insert node on the new line
        const offset = this.getOffsetInNode(range, insertNode);
        const textContent = insertNode.textContent || '';

        // Rebuild the insert node content with the BR in the middle
        insertNode.innerHTML = '';

        if (textContent.substring(0, offset)) {
          insertNode.appendChild(document.createTextNode(textContent.substring(0, offset)));
        }

        options.nodes.forEach(node => insertNode.appendChild(node));

        if (textContent.substring(offset)) {
          insertNode.appendChild(document.createTextNode(textContent.substring(offset)));
        }

        // Position cursor AFTER the insert node so next text creates new insert
        range.setStartAfter(insertNode);
        range.setEndAfter(insertNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        this.insertNodesIntoElement(insertNode, range, selection, options.nodes);
      }
    }

    this.notifyContentChange();
  }

  /**
   * Append content to an adjacent insert node (cursor is right after the node)
   * NOTE: Only merge TEXT content with adjacent insert nodes.
   * Block-level elements like <br> should NOT be merged - they should create new insert nodes
   * or be placed outside existing insert nodes.
   */
  private appendToAdjacentNode(
    insertNode: IceNode,
    range: Range,
    selection: Selection,
    options: { text?: string; nodes?: Node[] }
  ): void {
    const existingChangeId = insertNode.getAttribute(this.attributes.changeId);
    if (!existingChangeId) return;

    // Only merge TEXT into adjacent insert nodes, not block elements like <br>
    // Block elements should break the insert node chain
    if (options.nodes && options.nodes.length > 0) {
      const hasBlockElement = options.nodes.some(node =>
        node.nodeType === Node.ELEMENT_NODE &&
        this.isBlockOrBreakElement(node as HTMLElement)
      );

      if (hasBlockElement) {
        // Don't merge - create a new insert node instead
        const changeId = this.startBatchChange() || this.batchChangeId || this.getNewChangeId();
        this.createNewInsertNode(changeId, range, selection, options);
        return;
      }
    }

    this.updateChangeTime(existingChangeId);

    if (options.text) {
      const lastChild = insertNode.lastChild;

      // Check if last child is a BR - if so, insert text BEFORE the BR, not after
      if (lastChild && lastChild.nodeType === Node.ELEMENT_NODE &&
        (lastChild as HTMLElement).tagName === 'BR') {
        const textNode = document.createTextNode(options.text);
        insertNode.insertBefore(textNode, lastChild);

        range.setStart(textNode, options.text.length);
        range.setEnd(textNode, options.text.length);
      } else if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
        // Append to existing text node
        const textNode = lastChild as Text;
        const oldLength = textNode.textContent?.length || 0;
        textNode.textContent = (textNode.textContent || '') + options.text;

        // Position cursor INSIDE the insert node, at the end
        range.setStart(textNode, oldLength + options.text.length);
        range.setEnd(textNode, oldLength + options.text.length);
      } else {
        // Create new text node at the end
        const textNode = document.createTextNode(options.text);
        insertNode.appendChild(textNode);

        range.setStart(textNode, options.text.length);
        range.setEnd(textNode, options.text.length);
      }

      selection.removeAllRanges();
      selection.addRange(range);
    } else if (options.nodes && options.nodes.length > 0) {
      options.nodes.forEach(node => insertNode.appendChild(node));

      const lastNode = options.nodes[options.nodes.length - 1];
      if (lastNode.nodeType === Node.TEXT_NODE) {
        range.setStart(lastNode, (lastNode as Text).length);
        range.setEnd(lastNode, (lastNode as Text).length);
      } else {
        // For elements like <br>, position cursor AFTER the insert node
        // This breaks the chain so next text creates a new insert
        range.setStartAfter(insertNode);
        range.setEndAfter(insertNode);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.notifyContentChange();
  }

  /**
   * Check if an element is a block or break element that should break insert merging
   */
  private isBlockOrBreakElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toUpperCase();
    const blockElements = ['BR', 'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'TABLE', 'TR', 'TD', 'TH', 'BLOCKQUOTE',
      'PRE', 'HR', 'ADDRESS', 'ARTICLE', 'ASIDE', 'SECTION'];
    return blockElements.includes(tagName);
  }

  /**
   * Create a new insert node when no existing node can be merged with
   */
  private createNewInsertNode(
    changeId: string,
    range: Range,
    selection: Selection,
    options: { text?: string; nodes?: Node[] }
  ): void {
    const insertNode = this.createIceNode(this.INSERT_TYPE, changeId);

    if (options.text) {
      const textNode = document.createTextNode(options.text);
      insertNode.appendChild(textNode);

      range.insertNode(insertNode);

      // CRITICAL FIX: Position cursor INSIDE the insert node, at the end of text
      // This ensures subsequent characters will be merged into this node
      range.setStart(textNode, options.text.length);
      range.setEnd(textNode, options.text.length);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (options.nodes && options.nodes.length > 0) {
      options.nodes.forEach(node => insertNode.appendChild(node));
      range.insertNode(insertNode);

      const lastNode = insertNode.lastChild;
      if (lastNode) {
        if (lastNode.nodeType === Node.TEXT_NODE) {
          range.setStart(lastNode, (lastNode as Text).length);
          range.setEnd(lastNode, (lastNode as Text).length);
        } else {
          // For block elements like BR, position cursor AFTER the entire insert node
          // This ensures the next text input creates a NEW insert node (after the BR)
          range.setStartAfter(insertNode);
          range.setEndAfter(insertNode);
        }
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.addChange(this.INSERT_TYPE, [insertNode], changeId);
    this.notifyContentChange();
  }

  /**
   * Helper: Insert nodes into an existing element at range position
   */
  private insertNodesIntoElement(
    parentElement: HTMLElement,
    range: Range,
    selection: Selection,
    nodes: Node[]
  ): void {
    const offset = this.getOffsetInNode(range, parentElement);
    const textContent = parentElement.textContent || '';

    parentElement.innerHTML = '';

    if (textContent.substring(0, offset)) {
      parentElement.appendChild(document.createTextNode(textContent.substring(0, offset)));
    }

    nodes.forEach(node => parentElement.appendChild(node));

    if (textContent.substring(offset)) {
      parentElement.appendChild(document.createTextNode(textContent.substring(offset)));
    }

    const lastNode = nodes[nodes.length - 1];
    if (lastNode.nodeType === Node.TEXT_NODE) {
      range.setStart(lastNode, (lastNode as Text).length);
      range.setEnd(lastNode, (lastNode as Text).length);
    } else {
      range.setStartAfter(lastNode);
      range.setEndAfter(lastNode);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Check if cursor is positioned immediately after an insert node from the current user/session.
   * This handles the case where cursor is outside the </ins> tag but logically should merge.
   * 
   * IMPORTANT: We should NOT merge if the previous insert node ends with a BR element,
   * as that indicates a line break and the user expects new content to be on a new line.
   */
  private getAdjacentCurrentUserInsertNode(range: Range): IceNode | null {
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;

    // Case A: Cursor is at offset 0 of a text node - check previous sibling
    if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
      const prevSibling = startContainer.previousSibling;
      if (this.isUserInsertElement(prevSibling) && !this.endsWithBlockElement(prevSibling as HTMLElement)) {
        return prevSibling as IceNode;
      }

      // Also check if the text node is empty and has a previous sibling
      if (!startContainer.textContent || startContainer.textContent.length === 0) {
        if (this.isUserInsertElement(prevSibling) && !this.endsWithBlockElement(prevSibling as HTMLElement)) {
          return prevSibling as IceNode;
        }
      }
    }

    // Case B: Cursor is in an element node - check the node at offset-1
    if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
      const children = startContainer.childNodes;
      const prevChild = children[startOffset - 1];
      if (this.isUserInsertElement(prevChild) && !this.endsWithBlockElement(prevChild as HTMLElement)) {
        return prevChild as IceNode;
      }
    }

    // Case C: Cursor is at position 0 in an element, check previous sibling of parent
    if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset === 0) {
      const prevSibling = startContainer.previousSibling;
      if (this.isUserInsertElement(prevSibling) && !this.endsWithBlockElement(prevSibling as HTMLElement)) {
        return prevSibling as IceNode;
      }
    }

    // Case D: Check if we're in a text node that follows an insert element
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textContent = startContainer.textContent || '';
      if (textContent.length === 0 || startOffset === 0) {
        const prev = startContainer.previousSibling;
        if (this.isUserInsertElement(prev) && !this.endsWithBlockElement(prev as HTMLElement)) {
          return prev as IceNode;
        }
      }
    }

    return null;
  }

  /**
   * Check if an element ends with a block/break element (like BR)
   * If so, we should NOT merge new text into this insert node
   */
  private endsWithBlockElement(element: HTMLElement): boolean {
    const lastChild = element.lastChild;
    if (!lastChild) return false;

    if (lastChild.nodeType === Node.ELEMENT_NODE) {
      return this.isBlockOrBreakElement(lastChild as HTMLElement);
    }

    return false;
  }

  /**
   * Helper: Check if a node is an insert element belonging to the current user/session
   */
  private isUserInsertElement(node: Node | null): boolean {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

    const element = node as HTMLElement;
    return element.classList.contains(this.classes.insert) &&
      this.isCurrentUserIceNode(element as IceNode);
  }

  private getOffsetInNode(range: Range, node: Node): number {
    if (range.startContainer === node) {
      return range.startOffset;
    }

    if (range.startContainer.nodeType === Node.TEXT_NODE &&
      range.startContainer.parentNode === node) {
      return range.startOffset;
    }

    return node.textContent?.length || 0;
  }

  // ============================================================================
  // DELETE LOGIC
  // ============================================================================

  private deleteContents(isForward: boolean, isWord: boolean = false): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (!range.collapsed) {
      this.deleteSelection(range);
    } else {
      if (isForward) {
        this.deleteRight(range, isWord);
      } else {
        this.deleteLeft(range, isWord);
      }
    }
  }

  private deleteSelection(range: Range): void {
    if (range.collapsed) return;

    const changeId = this.startBatchChange() || this.batchChangeId || this.getNewChangeId();

    const commonAncestor = range.commonAncestorContainer;
    const insertNode = this.getCurrentUserIceNode(commonAncestor, this.INSERT_TYPE);

    // If we're inside a current user's insert node, just delete the content
    if (insertNode && this.isCurrentUserIceNode(insertNode)) {
      range.deleteContents();

      if (!insertNode.textContent && !insertNode.querySelector('br')) {
        insertNode.parentNode?.removeChild(insertNode);
      }

      this.notifyContentChange();
      return;
    }

    // Extract the contents to be marked as deleted
    const contents = range.extractContents();

    // Remove any empty insert nodes from the extracted content
    const emptyInserts = contents.querySelectorAll(`.${this.classes.insert}:empty`);
    emptyInserts.forEach(node => node.parentNode?.removeChild(node));

    // Check if the extracted content contains block elements
    const hasBlockContent = contents.querySelector('br, p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, table, blockquote, pre, hr') !== null;

    // Create delete node
    const deleteNode = this.createIceNode(this.DELETE_TYPE, changeId);

    while (contents.firstChild) {
      deleteNode.appendChild(contents.firstChild);
    }

    range.insertNode(deleteNode);

    // Position cursor after delete node
    range.setStartAfter(deleteNode);
    range.setEndAfter(deleteNode);
    range.collapse(true);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.addChange(this.DELETE_TYPE, [deleteNode], changeId);

    // Only merge if there are no block elements in the deleted content
    if (!hasBlockContent) {
      this.mergeDeleteNodes(deleteNode);
    }

    this.notifyContentChange();
  }

  private deleteLeft(range: Range, isWord: boolean = false): void {
    const container = range.startContainer;
    const offset = range.startOffset;

    // Case 1: At the beginning of a text node
    if (offset === 0) {
      // Check if previous sibling is a delete node we should skip over
      if (container.nodeType === Node.TEXT_NODE) {
        let prevNode = container.previousSibling;

        // Skip past delete nodes to find actual content to delete
        while (prevNode && prevNode.nodeType === Node.ELEMENT_NODE &&
          (prevNode as HTMLElement).classList.contains(this.classes.delete)) {
          prevNode = prevNode.previousSibling;
        }

        if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
          const text = prevNode.textContent || '';
          if (text.length > 0) {
            const deleteLength = isWord ? this.getWordLength(text, text.length, false) : 1;
            this.deleteCharacterFromNode(prevNode as Text, text.length - deleteLength, deleteLength, true);
            return;
          }
        }
      }

      const prevNode = this.getPreviousContentNode(container);
      if (!prevNode) return;

      if (prevNode.nodeType === Node.TEXT_NODE) {
        const text = prevNode.textContent || '';
        if (text.length > 0) {
          const deleteLength = isWord ? this.getWordLength(text, text.length, false) : 1;
          this.deleteCharacterFromNode(prevNode as Text, text.length - deleteLength, deleteLength, true);
        }
      }
    }
    // Case 2: In the middle or end of a text node
    else if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      const deleteLength = isWord ? this.getWordLength(text, offset, false) : 1;
      this.deleteCharacterFromNode(container as Text, offset - deleteLength, deleteLength, true);
    }
    // Case 3: In an element node
    else if (container.nodeType === Node.ELEMENT_NODE) {
      // Get the node before the cursor position
      const children = container.childNodes;
      if (offset > 0 && offset <= children.length) {
        let targetNode: Node | null = children[offset - 1];

        // Skip over delete nodes
        while (targetNode && targetNode.nodeType === Node.ELEMENT_NODE &&
          (targetNode as HTMLElement).classList.contains(this.classes.delete)) {
          targetNode = targetNode.previousSibling;
        }

        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
          const text = targetNode.textContent || '';
          if (text.length > 0) {
            const deleteLength = isWord ? this.getWordLength(text, text.length, false) : 1;
            this.deleteCharacterFromNode(targetNode as Text, text.length - deleteLength, deleteLength, true);
          }
        }
      }
    }
  }

  private deleteRight(range: Range, isWord: boolean = false): void {
    const container = range.startContainer;
    const offset = range.startOffset;

    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      if (offset < text.length) {
        const deleteLength = isWord ? this.getWordLength(text, offset, true) : 1;
        this.deleteCharacterFromNode(container as Text, offset, deleteLength, false);
      } else {
        // At end of text node, find next text node (skip over delete nodes)
        let nextNode: Node | null = container.nextSibling;

        while (nextNode && nextNode.nodeType === Node.ELEMENT_NODE &&
          (nextNode as HTMLElement).classList.contains(this.classes.delete)) {
          nextNode = nextNode.nextSibling;
        }

        if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
          const nextText = nextNode.textContent || '';
          const deleteLength = isWord ? this.getWordLength(nextText, 0, true) : 1;
          this.deleteCharacterFromNode(nextNode as Text, 0, deleteLength, false);
        } else {
          // Use original logic as fallback
          const foundNode = this.getNextContentNode(container);
          if (foundNode && foundNode.nodeType === Node.TEXT_NODE) {
            const nextText = foundNode.textContent || '';
            const deleteLength = isWord ? this.getWordLength(nextText, 0, true) : 1;
            this.deleteCharacterFromNode(foundNode as Text, 0, deleteLength, false);
          }
        }
      }
    } else if (container.nodeType === Node.ELEMENT_NODE) {
      // In an element node, find the text node at the cursor position
      const children = container.childNodes;
      if (offset < children.length) {
        let targetNode: Node | null = children[offset];

        // Skip over delete nodes
        while (targetNode && targetNode.nodeType === Node.ELEMENT_NODE &&
          (targetNode as HTMLElement).classList.contains(this.classes.delete)) {
          targetNode = targetNode.nextSibling;
        }

        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
          const text = targetNode.textContent || '';
          if (text.length > 0) {
            const deleteLength = isWord ? this.getWordLength(text, 0, true) : 1;
            this.deleteCharacterFromNode(targetNode as Text, 0, deleteLength, false);
          }
        }
      }
    }
  }

  private getWordLength(text: string, offset: number, forward: boolean): number {
    if (!text || offset < 0 || offset > text.length) return 1;

    let length = 0;

    if (forward) {
      for (let i = offset; i < text.length; i++) {
        if (/\s/.test(text[i])) {
          if (length === 0) {
            length++;
          } else {
            break;
          }
        } else {
          length++;
        }
      }
    } else {
      for (let i = offset - 1; i >= 0; i--) {
        if (/\s/.test(text[i])) {
          if (length === 0) {
            length++;
          } else {
            break;
          }
        } else {
          length++;
        }
      }
    }

    return Math.max(1, length);
  }

  private deleteCharacterFromNode(textNode: Text, offset: number, length: number, moveLeft: boolean): void {
    const text = textNode.textContent || '';
    const deletedText = text.substring(offset, offset + length);

    // Case 1: If we're inside a current user's insert node, just remove the text
    const insertNode = this.getCurrentUserIceNode(textNode, this.INSERT_TYPE);
    if (insertNode && this.isCurrentUserIceNode(insertNode)) {
      textNode.textContent = text.substring(0, offset) + text.substring(offset + length);

      const range = document.createRange();
      if (textNode.textContent.length > 0) {
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset);
      } else {
        const parent = insertNode.parentNode;
        if (parent) {
          range.setStartBefore(insertNode);
          range.setEndBefore(insertNode);
          parent.removeChild(insertNode);
        }
      }

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      this.notifyContentChange();
      return;
    }

    // Case 2: Not in an insert node - need to create delete tracking
    // Start or continue a batch change for consecutive deletes
    const changeId = this.startBatchChange() || this.batchChangeId || this.getNewChangeId();

    const beforeText = text.substring(0, offset);
    const afterText = text.substring(offset + length);
    const parent = textNode.parentNode;

    if (!parent) return;

    // IMPORTANT: Look for adjacent delete nodes BEFORE modifying the DOM
    // For BACKSPACE (moveLeft=true): 
    //   - We're deleting from the end, so the delete node (if any) would be AFTER this text node
    //   - After deletion, we want to PREPEND to that delete node
    // For DELETE KEY (moveLeft=false):
    //   - We're deleting from the start, so look for delete node BEFORE this text node
    //   - After deletion, we want to APPEND to that delete node

    let adjacentDeleteNode: IceNode | null = null;

    if (moveLeft) {
      // BACKSPACE: look for delete node that comes AFTER this text node
      // (because we're removing from the end of the text, the delete node would logically follow)
      let nextSibling = textNode.nextSibling;
      // Skip empty text nodes
      while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE &&
        !nextSibling.textContent?.trim()) {
        nextSibling = nextSibling.nextSibling;
      }
      if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
        const elem = nextSibling as HTMLElement;
        if (elem.classList.contains(this.classes.delete) &&
          this.isCurrentUserIceNode(elem as IceNode) &&
          !this.containsBlockElement(elem)) {
          adjacentDeleteNode = elem as IceNode;
        }
      }
    } else {
      // DELETE KEY: look for delete node that comes BEFORE this text node
      let prevSibling = textNode.previousSibling;
      // Skip empty text nodes
      while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE &&
        !prevSibling.textContent?.trim()) {
        prevSibling = prevSibling.previousSibling;
      }
      if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
        const elem = prevSibling as HTMLElement;
        if (elem.classList.contains(this.classes.delete) &&
          this.isCurrentUserIceNode(elem as IceNode) &&
          !this.containsBlockElement(elem)) {
          adjacentDeleteNode = elem as IceNode;
        }
      }
    }

    const range = document.createRange();

    if (adjacentDeleteNode) {
      // Merge with existing delete node
      const existingChangeId = adjacentDeleteNode.getAttribute(this.attributes.changeId) || changeId;

      if (moveLeft) {
        // BACKSPACE: Prepend to the delete node (deleted char goes at the START)
        // because we're deleting backwards: "ditor" -> delete 'r' -> delete 'o' -> "otir" in reverse = "rito" when prepending
        const firstChild = adjacentDeleteNode.firstChild;
        const newTextNode = document.createTextNode(deletedText);
        if (firstChild) {
          adjacentDeleteNode.insertBefore(newTextNode, firstChild);
        } else {
          adjacentDeleteNode.appendChild(newTextNode);
        }
      } else {
        // DELETE KEY: Append to the delete node (deleted char goes at the END)
        adjacentDeleteNode.appendChild(document.createTextNode(deletedText));
      }

      this.updateChangeTime(existingChangeId);

      // Update the text node content
      textNode.textContent = beforeText + afterText;

      // Handle cursor positioning
      if (textNode.textContent.length > 0) {
        if (moveLeft) {
          range.setStart(textNode, beforeText.length);
          range.setEnd(textNode, beforeText.length);
        } else {
          range.setStart(textNode, offset);
          range.setEnd(textNode, offset);
        }
      } else {
        // Text node is now empty, remove it
        const textNodeNextSibling = textNode.nextSibling;
        const textNodePrevSibling = textNode.previousSibling;
        parent.removeChild(textNode);

        if (moveLeft && textNodePrevSibling) {
          if (textNodePrevSibling.nodeType === Node.TEXT_NODE) {
            range.setStart(textNodePrevSibling, (textNodePrevSibling.textContent || '').length);
            range.setEnd(textNodePrevSibling, (textNodePrevSibling.textContent || '').length);
          } else {
            range.setStartAfter(textNodePrevSibling);
            range.setEndAfter(textNodePrevSibling);
          }
        } else if (!moveLeft && textNodeNextSibling) {
          if (textNodeNextSibling.nodeType === Node.TEXT_NODE) {
            range.setStart(textNodeNextSibling, 0);
            range.setEnd(textNodeNextSibling, 0);
          } else {
            range.setStartBefore(textNodeNextSibling);
            range.setEndBefore(textNodeNextSibling);
          }
        } else {
          // Position relative to the delete node
          if (moveLeft) {
            range.setStartBefore(adjacentDeleteNode);
            range.setEndBefore(adjacentDeleteNode);
          } else {
            range.setStartAfter(adjacentDeleteNode);
            range.setEndAfter(adjacentDeleteNode);
          }
        }
      }

      this.normalizeNode(adjacentDeleteNode);

    } else {
      // No adjacent delete node - create a new one
      const fragment = document.createDocumentFragment();

      // Add text before the deleted portion
      let beforeNode: Text | null = null;
      if (beforeText) {
        beforeNode = document.createTextNode(beforeText);
        fragment.appendChild(beforeNode);
      }

      // Create the delete node
      const deleteNode = this.createIceNode(this.DELETE_TYPE, changeId);
      deleteNode.appendChild(document.createTextNode(deletedText));
      fragment.appendChild(deleteNode);
      this.addChange(this.DELETE_TYPE, [deleteNode], changeId);

      // Add text after the deleted portion
      let afterNode: Text | null = null;
      if (afterText) {
        afterNode = document.createTextNode(afterText);
        fragment.appendChild(afterNode);
      }

      // Replace the original text node with our fragment
      parent.replaceChild(fragment, textNode);

      // Position cursor
      if (moveLeft) {
        // BACKSPACE: cursor goes before the delete node
        if (beforeNode) {
          range.setStart(beforeNode, beforeText.length);
          range.setEnd(beforeNode, beforeText.length);
        } else {
          range.setStartBefore(deleteNode);
          range.setEndBefore(deleteNode);
        }
      } else {
        // DELETE KEY: cursor stays at same visual position
        if (afterNode) {
          range.setStart(afterNode, 0);
          range.setEnd(afterNode, 0);
        } else {
          range.setStartAfter(deleteNode);
          range.setEndAfter(deleteNode);
        }
      }
    }

    range.collapse(true);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.notifyContentChange();
  }

  // ============================================================================
  // ICE NODE HELPERS
  // ============================================================================

  private getIceNode(node: Node, changeType: string): IceNode | null {
    const className = changeType === this.INSERT_TYPE ? this.classes.insert : this.classes.delete;

    let current: Node | null = node;
    while (current && current !== this.editorElement) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as HTMLElement;
        if (element.classList.contains(className)) {
          return element as IceNode;
        }
      }
      current = current.parentNode;
    }

    return null;
  }

  private getCurrentUserIceNode(node: Node, changeType: string): IceNode | null {
    const iceNode = this.getIceNode(node, changeType);
    if (iceNode && this.isCurrentUserIceNode(iceNode)) {
      return iceNode;
    }
    return null;
  }

  private isCurrentUserIceNode(node: IceNode): boolean {
    const userId = node.getAttribute(this.attributes.userId);
    const sessionId = node.getAttribute(this.attributes.sessionId);

    return userId === this.currentUser.id &&
      (!this.sessionId || sessionId === this.sessionId);
  }

  private getAdjacentDeleteNode(node: Node, beforeNode: boolean): IceNode | null {
    const sibling = beforeNode ? node.previousSibling : node.nextSibling;

    if (sibling && sibling.nodeType === Node.ELEMENT_NODE) {
      const element = sibling as HTMLElement;
      if (element.classList.contains(this.classes.delete)) {
        return element as IceNode;
      }
    }

    return null;
  }

  /**
   * Get an adjacent delete node belonging to the current user that can be merged with.
   * Does NOT return a delete node if it contains block elements (like BR) that would
   * indicate a line break - we don't want to merge across line breaks.
   */
  private getAdjacentCurrentUserDeleteNode(node: Node, before: boolean): IceNode | null {
    const deleteNode = this.getAdjacentDeleteNode(node, before);
    if (deleteNode && this.isCurrentUserIceNode(deleteNode)) {
      // Don't merge if the delete node contains block elements
      if (this.containsBlockElement(deleteNode)) {
        return null;
      }
      return deleteNode;
    }
    return null;
  }

  /**
   * Check if an element contains any block/break elements
   */
  private containsBlockElement(element: HTMLElement): boolean {
    const blockSelectors = 'br, p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, table, tr, td, th, blockquote, pre, hr';
    return element.querySelector(blockSelectors) !== null;
  }

  /**
   * Merges adjacent delete nodes that belong to the same user/session.
   * Does NOT merge across block elements like BR.
   */
  private mergeDeleteNodes(deleteNode: IceNode): void {
    if (!this.isCurrentUserIceNode(deleteNode)) return;

    const changeId = deleteNode.getAttribute(this.attributes.changeId);
    if (!changeId) return;

    // Don't merge if this delete node contains block elements
    if (this.containsBlockElement(deleteNode)) {
      this.normalizeNode(deleteNode);
      return;
    }

    let prevSibling = deleteNode.previousSibling;
    while (prevSibling) {
      if (prevSibling.nodeType === Node.ELEMENT_NODE) {
        const prevElement = prevSibling as IceNode;
        if (prevElement.classList.contains(this.classes.delete) &&
          this.isCurrentUserIceNode(prevElement) &&
          !this.containsBlockElement(prevElement)) {
          // Can merge - move content from deleteNode to prevElement
          while (deleteNode.firstChild) {
            prevElement.appendChild(deleteNode.firstChild);
          }
          deleteNode.parentNode?.removeChild(deleteNode);
          deleteNode = prevElement;
          prevSibling = deleteNode.previousSibling;
        } else {
          break;
        }
      } else if (prevSibling.nodeType === Node.TEXT_NODE) {
        if (!prevSibling.textContent?.trim()) {
          const temp = prevSibling.previousSibling;
          prevSibling.parentNode?.removeChild(prevSibling);
          prevSibling = temp;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    let nextSibling = deleteNode.nextSibling;
    while (nextSibling) {
      if (nextSibling.nodeType === Node.ELEMENT_NODE) {
        const nextElement = nextSibling as IceNode;
        if (nextElement.classList.contains(this.classes.delete) &&
          this.isCurrentUserIceNode(nextElement) &&
          !this.containsBlockElement(nextElement)) {
          // Can merge - move content from nextElement to deleteNode
          while (nextElement.firstChild) {
            deleteNode.appendChild(nextElement.firstChild);
          }
          const temp = nextElement.nextSibling;
          nextElement.parentNode?.removeChild(nextElement);
          nextSibling = temp;
        } else {
          break;
        }
      } else if (nextSibling.nodeType === Node.TEXT_NODE) {
        if (!nextSibling.textContent?.trim()) {
          const temp = nextSibling.nextSibling;
          nextSibling.parentNode?.removeChild(nextSibling);
          nextSibling = temp;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    this.normalizeNode(deleteNode);
  }

  private normalizeNode(node: Node): void {
    if (!node) return;

    if (node.normalize) {
      node.normalize();
      return;
    }

    let child = node.firstChild;
    while (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        while (child.nextSibling && child.nextSibling.nodeType === Node.TEXT_NODE) {
          (child as Text).appendData((child.nextSibling as Text).data);
          node.removeChild(child.nextSibling);
        }
      }
      child = child.nextSibling;
    }
  }

  private createIceNode(changeType: string, changeId: string): IceNode {
    const tag = changeType === this.INSERT_TYPE ? 'ins' : 'del';
    const node = document.createElement(tag) as IceNode;

    node.setAttribute(this.attributes.changeId, changeId);
    node.setAttribute(this.attributes.userId, this.currentUser.id);
    node.setAttribute(this.attributes.userName, this.currentUser.name);
    node.setAttribute(this.attributes.sessionId, this.sessionId);
    node.setAttribute(this.attributes.time, String(Date.now()));
    node.setAttribute(this.attributes.lastTime, String(Date.now()));

    node.className = changeType === this.INSERT_TYPE ? this.classes.insert : this.classes.delete;

    const userStyle = this.getUserStyle(this.currentUser.id);
    node.classList.add(userStyle);

    if (changeType === this.INSERT_TYPE) {
      node.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
      node.style.textDecoration = 'none';
    } else {
      node.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      node.style.textDecoration = 'line-through';
      node.style.color = '#d00';
    }

    node.setAttribute('contenteditable', 'true');
    node._iceNodeId = changeId;

    return node;
  }

  private getUserStyle(userId: string): string {
    const userIndex = userId.charCodeAt(0) % 10;
    return `${this.stylePrefix}-${userIndex}`;
  }

  private addChange(changeType: string, nodes: IceNode[], changeId: string): void {
    if (!this.changes[changeId]) {
      const now = new Date();
      this.changes[changeId] = {
        id: changeId,
        type: changeType === this.INSERT_TYPE ? 'insert' : 'delete',
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: now,
        content: this.getNodeContent(nodes[0]),
        spanElement: nodes[0]
      };

      const state = this.state$.value;
      state.changes.push(this.changes[changeId]);
      state.pendingCount = state.changes.filter(c => !c.isAccepted && !c.isRejected).length;
      this.state$.next({ ...state });
    }

    nodes.forEach(node => {
      node._iceNodeId = changeId;
    });
  }

  private updateChangeTime(changeId: string): void {
    const change = this.changes[changeId];
    if (change) {
      const now = Date.now();
      change.timestamp = new Date(now);

      if (this.editorElement) {
        const nodes = this.editorElement.querySelectorAll(`[${this.attributes.changeId}="${changeId}"]`);
        nodes.forEach(node => {
          node.setAttribute(this.attributes.lastTime, String(now));
        });
      }
    }
  }

  // ============================================================================
  // NAVIGATION HELPERS
  // ============================================================================

  private getPreviousContentNode(node: Node): Node | null {
    if (!node || node === this.editorElement) return null;

    let current: Node | null = node.previousSibling;

    while (current) {
      if (current.nodeType === Node.TEXT_NODE && current.textContent) {
        return current;
      }

      if (current.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(
          current,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (n) => {
              return n.textContent ?
                NodeFilter.FILTER_ACCEPT :
                NodeFilter.FILTER_SKIP;
            }
          }
        );

        let lastText: Node | null = null;
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          lastText = textNode;
        }
        if (lastText) return lastText;
      }

      current = current.previousSibling;
    }

    if (node.parentNode && node.parentNode !== this.editorElement) {
      return this.getPreviousContentNode(node.parentNode);
    }

    return null;
  }

  private getNextContentNode(node: Node): Node | null {
    if (!node || node === this.editorElement) return null;

    let current: Node | null = node.nextSibling;

    while (current) {
      if (current.nodeType === Node.TEXT_NODE && current.textContent) {
        return current;
      }

      if (current.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(
          current,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (n) => {
              return n.textContent ?
                NodeFilter.FILTER_ACCEPT :
                NodeFilter.FILTER_SKIP;
            }
          }
        );

        const firstText = walker.nextNode();
        if (firstText) return firstText;
      }

      current = current.nextSibling;
    }

    if (node.parentNode && node.parentNode !== this.editorElement) {
      return this.getNextContentNode(node.parentNode);
    }

    return null;
  }

  private getNodeContent(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    const element = node as HTMLElement;
    return element.textContent || '';
  }

  // ============================================================================
  // ACCEPT / REJECT CHANGES
  // ============================================================================

  acceptAllChanges(): void {
    const state = this.state$.value;

    state.changes.forEach(change => {
      if (!change.isAccepted && !change.isRejected && change.spanElement) {
        this.acceptChange(change.id);
      }
    });
  }

  rejectAllChanges(): void {
    const state = this.state$.value;

    state.changes.forEach(change => {
      if (!change.isAccepted && !change.isRejected && change.spanElement) {
        this.rejectChange(change.id);
      }
    });
  }

  acceptChange(changeId: string): void {
    const change = this.changes[changeId];
    if (!change || change.isAccepted || change.isRejected) return;

    const nodes = this.editorElement?.querySelectorAll(`[${this.attributes.changeId}="${changeId}"]`);

    nodes?.forEach((node: Element) => {
      const element = node as HTMLElement;

      if (element.classList.contains(this.classes.insert)) {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
          parent.removeChild(element);
        }
      } else if (element.classList.contains(this.classes.delete)) {
        element.parentNode?.removeChild(element);
      }
    });

    change.isAccepted = true;
    this.updatePendingCount();
  }

  rejectChange(changeId: string): void {
    const change = this.changes[changeId];
    if (!change || change.isAccepted || change.isRejected) return;

    const nodes = this.editorElement?.querySelectorAll(`[${this.attributes.changeId}="${changeId}"]`);

    nodes?.forEach((node: Element) => {
      const element = node as HTMLElement;

      if (element.classList.contains(this.classes.insert)) {
        element.parentNode?.removeChild(element);
      } else if (element.classList.contains(this.classes.delete)) {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
          parent.removeChild(element);
        }
      }
    });

    change.isRejected = true;
    this.updatePendingCount();
  }

  acceptChangeAtSelection(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const iceNode = this.getIceNodeAtRange(range);

    if (iceNode) {
      const changeId = iceNode.getAttribute(this.attributes.changeId);
      if (changeId) {
        this.acceptChange(changeId);
        return true;
      }
    }

    return false;
  }

  rejectChangeAtSelection(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const iceNode = this.getIceNodeAtRange(range);

    if (iceNode) {
      const changeId = iceNode.getAttribute(this.attributes.changeId);
      if (changeId) {
        this.rejectChange(changeId);
        return true;
      }
    }

    return false;
  }

  private getIceNodeAtRange(range: Range): IceNode | null {
    let node: Node | null = range.commonAncestorContainer;

    while (node && node !== this.editorElement) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.classList.contains(this.classes.insert) ||
          element.classList.contains(this.classes.delete)) {
          return element as IceNode;
        }
      }
      node = node.parentNode;
    }

    return null;
  }

  private updatePendingCount(): void {
    const state = this.state$.value;
    state.pendingCount = state.changes.filter(c => !c.isAccepted && !c.isRejected).length;
    this.state$.next({ ...state });
  }

  // ============================================================================
  // CONTENT OUTPUT
  // ============================================================================

  getContent(element: HTMLElement, mode: EditorOutputMode = EditorOutputMode.Clean): string {
    if (mode === EditorOutputMode.Clean) {
      return this.getCleanContent(element);
    } else {
      return this.getContentWithTrackedChanges(element);
    }
  }

  private getCleanContent(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;

    const insertNodes = clone.querySelectorAll(`.${this.classes.insert}`);
    insertNodes.forEach((node: Element) => {
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
      }
    });

    const deleteNodes = clone.querySelectorAll(`.${this.classes.delete}`);
    deleteNodes.forEach((node: Element) => {
      node.parentNode?.removeChild(node);
    });

    return clone.innerHTML;
  }

  private getContentWithTrackedChanges(element: HTMLElement): string {
    return element.innerHTML;
  }

  // ============================================================================
  // INITIALIZATION & RELOAD
  // ============================================================================

  private initializeExistingContent(): void {
    if (!this.editorElement) return;

    const iceNodes = this.editorElement.querySelectorAll(`.${this.classes.insert}, .${this.classes.delete}`);

    iceNodes.forEach((node: Element) => {
      const iceNode = node as IceNode;
      const changeId = iceNode.getAttribute(this.attributes.changeId);

      if (changeId && !this.changes[changeId]) {
        const changeType = iceNode.classList.contains(this.classes.insert) ? 'insert' : 'delete';
        const userId = iceNode.getAttribute(this.attributes.userId) || '';
        const userName = iceNode.getAttribute(this.attributes.userName) || '';
        const timestamp = parseInt(iceNode.getAttribute(this.attributes.time) || '0');

        this.changes[changeId] = {
          id: changeId,
          type: changeType,
          userId: userId,
          userName: userName,
          timestamp: new Date(timestamp),
          content: this.getNodeContent(iceNode),
          spanElement: iceNode
        };

        const state = this.state$.value;
        state.changes.push(this.changes[changeId]);
        state.pendingCount = state.changes.filter(c => !c.isAccepted && !c.isRejected).length;
        this.state$.next({ ...state });
      }
    });
  }

  reload(): void {
    this.loadFromDom();
  }

  private loadFromDom(): void {
    if (!this.editorElement) return;

    this.changes = {};

    const iceNodes = this.editorElement.querySelectorAll(
      `.${this.classes.insert}, .${this.classes.delete}`
    );

    iceNodes.forEach((node: Element) => {
      const element = node as HTMLElement;

      const changeId = element.getAttribute(this.attributes.changeId);
      const userId = element.getAttribute(this.attributes.userId) || '';
      const userName = element.getAttribute(this.attributes.userName) || '';
      const timeStr = element.getAttribute(this.attributes.time);

      if (!changeId) return;

      const type: 'insert' | 'delete' = element.classList.contains(this.classes.insert)
        ? 'insert'
        : 'delete';

      const timestamp = timeStr ? new Date(parseInt(timeStr, 10)) : new Date();
      const content = element.textContent || '';

      if (!this.changes[changeId]) {
        this.changes[changeId] = {
          id: changeId,
          type: type,
          userId: userId,
          userName: userName,
          timestamp: timestamp,
          content: content,
          spanElement: element,
          isAccepted: false,
          isRejected: false
        };
      }
    });

    this.updateStateFromChanges();
  }

  private updateStateFromChanges(): void {
    const changesArray = Object.values(this.changes);
    const pendingCount = changesArray.filter(c => !c.isAccepted && !c.isRejected).length;

    this.state$.next({
      ...this.state$.value,
      changes: changesArray,
      pendingCount: pendingCount
    });
  }

  reloadFromDom(): void {
    this.reload();
  }

  // ============================================================================
  // OPTIONAL: Merge fragmented insert nodes (cleanup utility)
  // ============================================================================

  /**
   * Merges adjacent insert nodes from the same user/session.
   * Call this periodically or on blur/save as a cleanup function.
   * Does NOT merge across block elements like BR.
   */
  public mergeAdjacentInsertNodes(): void {
    if (!this.editorElement) return;

    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

    const insertNodes = Array.from(this.editorElement.querySelectorAll(`.${this.classes.insert}`));
    const processedNodes = new Set<Node>();

    for (const node of insertNodes) {
      if (processedNodes.has(node)) continue;

      const element = node as IceNode;
      if (!this.isCurrentUserIceNode(element)) continue;

      // Don't process nodes that end with block elements
      if (this.endsWithBlockElement(element)) {
        processedNodes.add(element);
        continue;
      }

      let nextSibling = element.nextSibling;

      while (nextSibling) {
        if (nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent?.trim()) {
          const emptyNode = nextSibling;
          nextSibling = nextSibling.nextSibling;
          emptyNode.parentNode?.removeChild(emptyNode);
          continue;
        }

        if (nextSibling.nodeType === Node.ELEMENT_NODE) {
          const nextElement = nextSibling as IceNode;

          if (nextElement.classList.contains(this.classes.insert) &&
            this.isCurrentUserIceNode(nextElement) &&
            !this.startsWithBlockElement(nextElement)) {

            while (nextElement.firstChild) {
              element.appendChild(nextElement.firstChild);
            }

            const nextTime = parseInt(nextElement.getAttribute(this.attributes.lastTime) || '0');
            const currTime = parseInt(element.getAttribute(this.attributes.lastTime) || '0');
            if (nextTime > currTime) {
              element.setAttribute(this.attributes.lastTime, String(nextTime));
            }

            processedNodes.add(nextElement);
            const temp = nextElement.nextSibling;
            nextElement.parentNode?.removeChild(nextElement);
            nextSibling = temp;

            // Stop if the merged content ends with a block element
            if (this.endsWithBlockElement(element)) {
              break;
            }
            continue;
          }
        }

        break;
      }

      this.normalizeNode(element);
      processedNodes.add(element);
    }

    if (savedRange && selection) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (e) {
        // Selection may be invalid after DOM changes
      }
    }
  }

  /**
   * Merges adjacent delete nodes from the same user/session.
   * Call this periodically or on blur/save as a cleanup function.
   * Does NOT merge across block elements like BR.
   */
  public mergeAdjacentDeleteNodes(): void {
    if (!this.editorElement) return;

    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

    const deleteNodes = Array.from(this.editorElement.querySelectorAll(`.${this.classes.delete}`));
    const processedNodes = new Set<Node>();

    for (const node of deleteNodes) {
      if (processedNodes.has(node)) continue;

      const element = node as IceNode;
      if (!this.isCurrentUserIceNode(element)) continue;

      // Don't process nodes that contain block elements
      if (this.containsBlockElement(element)) {
        processedNodes.add(element);
        continue;
      }

      let nextSibling = element.nextSibling;

      while (nextSibling) {
        if (nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent?.trim()) {
          const emptyNode = nextSibling;
          nextSibling = nextSibling.nextSibling;
          emptyNode.parentNode?.removeChild(emptyNode);
          continue;
        }

        if (nextSibling.nodeType === Node.ELEMENT_NODE) {
          const nextElement = nextSibling as IceNode;

          if (nextElement.classList.contains(this.classes.delete) &&
            this.isCurrentUserIceNode(nextElement) &&
            !this.containsBlockElement(nextElement)) {

            while (nextElement.firstChild) {
              element.appendChild(nextElement.firstChild);
            }

            const nextTime = parseInt(nextElement.getAttribute(this.attributes.lastTime) || '0');
            const currTime = parseInt(element.getAttribute(this.attributes.lastTime) || '0');
            if (nextTime > currTime) {
              element.setAttribute(this.attributes.lastTime, String(nextTime));
            }

            processedNodes.add(nextElement);
            const temp = nextElement.nextSibling;
            nextElement.parentNode?.removeChild(nextElement);
            nextSibling = temp;
            continue;
          }
        }

        break;
      }

      this.normalizeNode(element);
      processedNodes.add(element);
    }

    if (savedRange && selection) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (e) {
        // Selection may be invalid after DOM changes
      }
    }
  }

  /**
   * Check if an element starts with a block/break element
   */
  private startsWithBlockElement(element: HTMLElement): boolean {
    const firstChild = element.firstChild;
    if (!firstChild) return false;

    if (firstChild.nodeType === Node.ELEMENT_NODE) {
      return this.isBlockOrBreakElement(firstChild as HTMLElement);
    }

    return false;
  }
}