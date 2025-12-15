/**
 * Track Changes Module - Barrel Export
 * 
 * This module provides a modular track changes implementation
 * inspired by CKEditor's LITE/ICE.js plugin.
 */

// Constants and interfaces
export * from './track-changes.constants';

// Sub-services (for advanced usage)
export { TrackChangesStateService } from './track-changes-state.service';
export { TrackChangesNodeService } from './track-changes-node.service';
export { TrackChangesDomService } from './track-changes-dom.service';
export { TrackChangesInsertService, InsertOptions } from './track-changes-insert.service';
export { TrackChangesDeleteService } from './track-changes-delete.service';
export { TrackChangesAcceptRejectService } from './track-changes-accept-reject.service';
export { TrackChangesEventService } from './track-changes-event.service';
export { TrackChangesContextMenuService, TrackChangesContextMenuData } from './track-changes-context-menu.service';

// Main orchestrator service (primary import)
export { TrackChangesService } from './track-changes.service';