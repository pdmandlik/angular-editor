/**
 * Extended HTMLElement interface for ICE nodes
 */
export interface IceNode extends HTMLElement {
    _iceNodeId?: string;
}

/**
 * Batch change tracking structure
 */
export interface BatchChange {
    id: string;
    type: 'insert' | 'delete';
    startTime: number;
    nodes: IceNode[];
}

/**
 * User information for track changes
 */
export interface TrackChangesUser {
    id: string;
    name: string;
}

/**
 * ICE.js standard data attributes for track change nodes
 */
export const ICE_ATTRIBUTES = {
    changeId: 'data-cid',
    userId: 'data-userid',
    userName: 'data-username',
    sessionId: 'data-session-id',
    time: 'data-time',
    lastTime: 'data-last-change-time',
    changeData: 'data-changedata'
} as const;

/**
 * CSS class names for track change nodes (LITE/ICE.js standard)
 */
export const ICE_CLASSES = {
    insert: 'ice-ins',
    delete: 'ice-del'
} as const;

/**
 * Change type identifiers
 */
export const CHANGE_TYPES = {
    INSERT: 'insertType',
    DELETE: 'deleteType'
} as const;

/**
 * Style prefix for user-specific styles
 */
export const STYLE_PREFIX = 'ice-cts';

/**
 * Default batch timeout in milliseconds
 */
export const BATCH_TIMEOUT = 1000;

/**
 * Block-level element tag names
 */
export const BLOCK_ELEMENTS = [
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'TD', 'TH', 'BLOCKQUOTE', 'PRE', 'ADDRESS',
    'UL', 'OL', 'TABLE', 'TR', 'HR', 'ARTICLE', 'ASIDE', 'SECTION'
] as const;

/**
 * Block or break elements (includes BR)
 */
export const BLOCK_OR_BREAK_ELEMENTS = [
    'BR', ...BLOCK_ELEMENTS
] as const;

/**
 * Default insert node inline styles
 */
export const INSERT_STYLES = {
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    textDecoration: 'none'
} as const;

/**
 * Default delete node inline styles
 */
export const DELETE_STYLES = {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    textDecoration: 'line-through',
    color: '#d00'
} as const;

/**
 * Type guard to check if a node is an IceNode
 */
export function isIceNode(node: Node | null): node is IceNode {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as HTMLElement;
    return el.classList.contains(ICE_CLASSES.insert) ||
        el.classList.contains(ICE_CLASSES.delete);
}

/**
 * Get change type from class name
 */
export function getChangeTypeFromClass(element: HTMLElement): 'insert' | 'delete' | null {
    if (element.classList.contains(ICE_CLASSES.insert)) return 'insert';
    if (element.classList.contains(ICE_CLASSES.delete)) return 'delete';
    return null;
}

/**
 * Check if element is an insert node
 */
export function isInsertNode(element: HTMLElement): boolean {
    return element.classList.contains(ICE_CLASSES.insert);
}

/**
 * Check if element is a delete node
 */
export function isDeleteNode(element: HTMLElement): boolean {
    return element.classList.contains(ICE_CLASSES.delete);
}