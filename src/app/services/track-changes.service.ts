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

  // NEW: Callback for history manager integration
  private onContentChangeCallback: (() => void) | null = null;

  constructor() {
    this.generateSessionId();
  }

  private generateSessionId(): void {
    const now = new Date();
    this.sessionId = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${now.getTime()}`;
  }

  // NEW: Register content change callback for undo/redo integration
  setContentChangeCallback(callback: () => void): void {
    this.onContentChangeCallback = callback;
  }

  // NEW: Notify that content has changed
  private notifyContentChange(): void {
    if (this.onContentChangeCallback) {
      this.onContentChangeCallback();
    }
  }

  // Public API methods matching LITE interface
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

  private insert(options: { text?: string; nodes?: Node[] }): void {
    const changeId = this.startBatchChange() || this.batchChangeId || this.getNewChangeId();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let range = selection.getRangeAt(0);

    if (!range.collapsed) {
      this.deleteSelection(range);
      range = selection.getRangeAt(0);
    }

    const currentInsertNode = this.getCurrentUserIceNode(range.startContainer, this.INSERT_TYPE);

    if (currentInsertNode && this.isCurrentUserIceNode(currentInsertNode)) {
      const existingChangeId = currentInsertNode.getAttribute(this.attributes.changeId);
      if (existingChangeId) {
        this.updateChangeTime(existingChangeId);

        if (options.text) {
          const offset = this.getOffsetInNode(range, currentInsertNode);
          const textContent = currentInsertNode.textContent || '';
          currentInsertNode.textContent =
            textContent.substring(0, offset) +
            options.text +
            textContent.substring(offset);

          const newOffset = offset + options.text.length;
          const textNode = currentInsertNode.firstChild as Text;
          if (textNode) {
            range.setStart(textNode, newOffset);
            range.setEnd(textNode, newOffset);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    } else {
      const insertNode = this.createIceNode(this.INSERT_TYPE, changeId);

      if (options.text) {
        insertNode.appendChild(document.createTextNode(options.text));
      } else if (options.nodes) {
        options.nodes.forEach(node => insertNode.appendChild(node));
      }

      range.insertNode(insertNode);

      range.setStartAfter(insertNode);
      range.setEndAfter(insertNode);
      selection.removeAllRanges();
      selection.addRange(range);

      this.addChange(this.INSERT_TYPE, [insertNode], changeId);
    }

    // NOTIFY HISTORY MANAGER
    this.notifyContentChange();
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

    if (insertNode && this.isCurrentUserIceNode(insertNode)) {
      range.deleteContents();

      if (!insertNode.textContent) {
        insertNode.parentNode?.removeChild(insertNode);
      }

      // NOTIFY HISTORY MANAGER
      this.notifyContentChange();
      return;
    }

    const contents = range.extractContents();

    const emptyInserts = contents.querySelectorAll(`.${this.classes.insert}:empty`);
    emptyInserts.forEach(node => node.parentNode?.removeChild(node));

    const deleteNode = this.createIceNode(this.DELETE_TYPE, changeId);

    while (contents.firstChild) {
      deleteNode.appendChild(contents.firstChild);
    }

    range.insertNode(deleteNode);

    range.setStartAfter(deleteNode);
    range.setEndAfter(deleteNode);
    range.collapse(true);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.addChange(this.DELETE_TYPE, [deleteNode], changeId);
    this.mergeDeleteNodes(deleteNode);

    // NOTIFY HISTORY MANAGER
    this.notifyContentChange();
  }

  private deleteLeft(range: Range, isWord: boolean = false): void {
    const container = range.startContainer;
    const offset = range.startOffset;

    if (offset === 0) {
      const prevNode = this.getPreviousContentNode(container);
      if (!prevNode) return;

      if (prevNode.nodeType === Node.TEXT_NODE) {
        const text = prevNode.textContent || '';
        if (text.length > 0) {
          const deleteLength = isWord ? this.getWordLength(text, text.length, false) : 1;
          this.deleteCharacterFromNode(prevNode as Text, text.length - deleteLength, deleteLength, true);
        }
      }
    } else if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      const deleteLength = isWord ? this.getWordLength(text, offset, false) : 1;
      this.deleteCharacterFromNode(container as Text, offset - deleteLength, deleteLength, true);
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
        const nextNode = this.getNextContentNode(container);
        if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
          const nextText = nextNode.textContent || '';
          const deleteLength = isWord ? this.getWordLength(nextText, 0, true) : 1;
          this.deleteCharacterFromNode(nextNode as Text, 0, deleteLength, false);
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

      // NOTIFY HISTORY MANAGER
      this.notifyContentChange();
      return;
    }

    let changeId = this.batchChangeId;

    const prevDelete = moveLeft ?
      this.getAdjacentCurrentUserDeleteNode(textNode, true) : null;
    const nextDelete = !moveLeft ?
      this.getAdjacentCurrentUserDeleteNode(textNode, false) : null;

    if (prevDelete) {
      changeId = prevDelete.getAttribute(this.attributes.changeId) || changeId;
    } else if (nextDelete) {
      changeId = nextDelete.getAttribute(this.attributes.changeId) || changeId;
    }

    if (!changeId) {
      changeId = this.getNewChangeId();
    }

    const beforeText = text.substring(0, offset);
    const afterText = text.substring(offset + length);
    const parent = textNode.parentNode;

    if (!parent) return;

    const fragment = document.createDocumentFragment();
    let cursorNode: Node | null = null;
    let cursorOffset = 0;

    if (beforeText) {
      const beforeNode = document.createTextNode(beforeText);
      fragment.appendChild(beforeNode);
      if (moveLeft) {
        cursorNode = beforeNode;
        cursorOffset = beforeText.length;
      }
    }

    if (prevDelete && prevDelete.getAttribute(this.attributes.changeId) === changeId) {
      prevDelete.appendChild(document.createTextNode(deletedText));
      this.updateChangeTime(changeId);
    } else if (nextDelete && nextDelete.getAttribute(this.attributes.changeId) === changeId) {
      const firstChild = nextDelete.firstChild;
      if (firstChild) {
        nextDelete.insertBefore(document.createTextNode(deletedText), firstChild);
      } else {
        nextDelete.appendChild(document.createTextNode(deletedText));
      }
      this.updateChangeTime(changeId);
    } else {
      const deleteNode = this.createIceNode(this.DELETE_TYPE, changeId);
      deleteNode.appendChild(document.createTextNode(deletedText));
      fragment.appendChild(deleteNode);
      this.addChange(this.DELETE_TYPE, [deleteNode], changeId);

      if (!cursorNode && moveLeft) {
        cursorNode = deleteNode;
      }
    }

    if (afterText) {
      const afterNode = document.createTextNode(afterText);
      fragment.appendChild(afterNode);
      if (!moveLeft) {
        cursorNode = afterNode;
        cursorOffset = 0;
      }
    }

    parent.replaceChild(fragment, textNode);

    const range = document.createRange();
    if (cursorNode) {
      if (cursorNode.nodeType === Node.TEXT_NODE) {
        range.setStart(cursorNode, cursorOffset);
        range.setEnd(cursorNode, cursorOffset);
      } else {
        if (moveLeft) {
          range.setStartBefore(cursorNode);
          range.setEndBefore(cursorNode);
        } else {
          range.setStartAfter(cursorNode);
          range.setEndAfter(cursorNode);
        }
      }
    }
    range.collapse(true);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // NOTIFY HISTORY MANAGER
    this.notifyContentChange();
  }

  private getAdjacentCurrentUserDeleteNode(node: Node, before: boolean): IceNode | null {
    const deleteNode = this.getAdjacentDeleteNode(node, before);
    if (deleteNode && this.isCurrentUserIceNode(deleteNode)) {
      return deleteNode;
    }
    return null;
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

  private mergeDeleteNodes(deleteNode: IceNode): void {
    if (!this.isCurrentUserIceNode(deleteNode)) return;

    const changeId = deleteNode.getAttribute(this.attributes.changeId);
    if (!changeId) return;

    let prevSibling = deleteNode.previousSibling;
    while (prevSibling) {
      if (prevSibling.nodeType === Node.ELEMENT_NODE) {
        const prevElement = prevSibling as IceNode;
        if (prevElement.classList.contains(this.classes.delete) &&
          this.isCurrentUserIceNode(prevElement) &&
          prevElement.getAttribute(this.attributes.changeId) === changeId) {
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
          nextElement.getAttribute(this.attributes.changeId) === changeId) {
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
      const next = child.nextSibling;

      if (child.nodeType === Node.TEXT_NODE && next && next.nodeType === Node.TEXT_NODE) {
        child.textContent = (child.textContent || '') + (next.textContent || '');
        node.removeChild(next);
      } else {
        child = next;
      }
    }
  }

  private cleanup(): void {
    if (!this.editorElement) return;

    const emptyNodes = this.editorElement.querySelectorAll(
      `.${this.classes.insert}:empty, .${this.classes.delete}:empty`
    );

    emptyNodes.forEach(node => {
      node.parentNode?.removeChild(node);
    });

    Object.keys(this.changes).forEach(changeId => {
      const change = this.changes[changeId];
      if (change.spanElement && !document.contains(change.spanElement)) {
        delete this.changes[changeId];
      }
    });

    this.updatePendingCount();
  }

  private getPreviousContentNode(node: Node): Node | null {
    let current = node.previousSibling;

    while (current) {
      if (current.nodeType === Node.TEXT_NODE && current.textContent?.trim()) {
        return current;
      }
      if (current.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(
          current,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              return node.textContent?.trim() ?
                NodeFilter.FILTER_ACCEPT :
                NodeFilter.FILTER_SKIP;
            }
          }
        );

        let lastText: Node | null = null;
        let node: Node | null;
        while (node = walker.nextNode()) {
          lastText = node;
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
    let current = node.nextSibling;

    while (current) {
      if (current.nodeType === Node.TEXT_NODE && current.textContent?.trim()) {
        return current;
      }
      if (current.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(
          current,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              return node.textContent?.trim() ?
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
}