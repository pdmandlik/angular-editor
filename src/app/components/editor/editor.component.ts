/**
 * Editor Component (Refactored)
 * 
 * Main WYSIWYG editor component for Angular 14+.
 * Acts as a coordinator between toolbar components and services,
 * delegating complex logic to specialized services.
 * 
 * RESPONSIBILITIES (kept minimal):
 * - Template binding and component lifecycle
 * - Service initialization and coordination
 * - Event delegation to child components
 * - Output emission to parent components
 * 
 * DELEGATED TO SERVICES:
 * - EditorEventsService: All event handling
 * - TrackChangesService: Track changes operations
 * - HistoryManagerService: Undo/redo management
 * - ContentSanitizerService: Input sanitization
 */

import {
  Component, Input, Output, EventEmitter,
  ElementRef, ViewChild,
  OnInit, AfterViewInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil, debounceTime } from 'rxjs';

// Toolbar Components
import { TextFormattingToolbarComponent } from '../editor-toolbar/text-formatting-toolbar/text-formatting-toolbar.component';
import { AlignmentToolbarComponent } from '../editor-toolbar/alignment-toolbar/alignment-toolbar.component';
import { ListToolbarComponent } from '../editor-toolbar/list-toolbar/list-toolbar.component';
import { HistoryToolbarComponent } from '../editor-toolbar/history-toolbar/history-toolbar.component';
import { TableToolbarComponent } from '../editor-toolbar/table-toolbar/table-toolbar.component';
import { ImageToolbarComponent } from '../editor-toolbar/image-toolbar/image-toolbar.component';
import { LineHeightToolbarComponent } from '../editor-toolbar/line-height-toolbar/line-height-toolbar.component';
import { TrackChangesToolbarComponent } from '../track-changes/track-changes-toolbar/track-changes-toolbar.component';
import { TrackChangesContextMenuComponent } from '../track-changes/track-changes-context-menu/track-changes-context-menu.component';
import { TableContextMenuComponent, TableContextAction } from '../editor-toolbar/table-toolbar/table-context-menu.component';

// Directives
import { TrackChangesTooltipDirective } from 'src/app/directives/track-changes-tooltip.directive';

// Services
import { CommandExecutorService } from 'src/app/services/command-executor.service';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';
import { ContentSanitizerService } from 'src/app/services/content-sanitizer.service';
import { TrackChangesService } from 'src/app/services/track-changes';
import { TrackChangesContextMenuService } from 'src/app/services/track-changes/track-changes-context-menu.service';
import { HistoryManagerService } from 'src/app/services/history-manager.service';
import { EnterKeyService } from 'src/app/services/enter-key.service';
import { EditorEventsService } from 'src/app/services/editor-events.service';
import { TableOperationsService, TableSelectionService } from 'src/app/services/table';

// Types
import {
  TrackChangesState,
  EditorOutputMode,
  EnterMode,
  DEFAULT_EDITOR_CONFIG
} from 'src/app/entities/editor-config';

/** Debounce time for content change emissions (ms) */
const CONTENT_DEBOUNCE_MS = 300;

@Component({
  selector: 'cg-editor',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatDividerModule,
    TextFormattingToolbarComponent,
    AlignmentToolbarComponent,
    ListToolbarComponent,
    HistoryToolbarComponent,
    TableToolbarComponent,
    ImageToolbarComponent,
    LineHeightToolbarComponent,
    TrackChangesToolbarComponent,
    TrackChangesContextMenuComponent,
    TrackChangesTooltipDirective,
    TableContextMenuComponent
  ],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  providers: [EnterKeyService, EditorEventsService]
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  // ========================================================================
  // VIEW CHILDREN
  // ========================================================================

  @ViewChild('editor') editor!: ElementRef<HTMLElement>;
  @ViewChild('textFormattingToolbar') textFormattingToolbar!: TextFormattingToolbarComponent;
  @ViewChild('lineHeightToolbar') lineHeightToolbar!: LineHeightToolbarComponent;
  @ViewChild('historyToolbar') historyToolbar!: HistoryToolbarComponent;
  @ViewChild('trackChangesContextMenu') trackChangesContextMenu!: TrackChangesContextMenuComponent;
  @ViewChild('tableToolbar') tableToolbar!: TableToolbarComponent;
  @ViewChild('tableContextMenu') tableContextMenu!: TableContextMenuComponent;

  // ========================================================================
  // INPUTS
  // ========================================================================

  /** Initial HTML content for the editor */
  @Input() content = '';

  /** Editor height (CSS value) */
  @Input() height = '400px';

  /** Placeholder text when editor is empty */
  @Input() placeholder = 'Start typing here...';

  /** Output mode for content (clean or with track changes) */
  @Input() outputMode: EditorOutputMode = EditorOutputMode.WithTrackedChanges;

  /** Behavior when Enter key is pressed */
  @Input() enterMode: EnterMode = DEFAULT_EDITOR_CONFIG.enterMode;

  /** Behavior when Shift+Enter is pressed */
  @Input() shiftEnterMode: EnterMode = DEFAULT_EDITOR_CONFIG.shiftEnterMode;

  // ========================================================================
  // OUTPUTS
  // ========================================================================

  /** Emits when content changes (debounced) */
  @Output() contentChange = new EventEmitter<string>();

  // ========================================================================
  // PUBLIC STATE (for template binding)
  // ========================================================================

  /** Current track changes visibility state */
  trackChangesVisible = true;

  /** Current track changes state */
  trackChangesState: TrackChangesState = {
    isEnabled: false,
    isVisible: false,
    changes: [],
    pendingCount: 0
  };

  // ========================================================================
  // PRIVATE STATE
  // ========================================================================

  private destroy$ = new Subject<void>();
  private contentChange$ = new Subject<string>();

  // ========================================================================
  // CONSTRUCTOR
  // ========================================================================

  constructor(
    private commandExecutor: CommandExecutorService,
    private selectionManager: SelectionManagerService,
    private sanitizer: ContentSanitizerService,
    private eventsService: EditorEventsService,
    public trackChangesService: TrackChangesService,
    private contextMenuService: TrackChangesContextMenuService,
    public historyManager: HistoryManagerService,
    private enterKeyService: EnterKeyService,
    private tableOps: TableOperationsService,
    private tableSelection: TableSelectionService
  ) { }

  // ========================================================================
  // LIFECYCLE HOOKS
  // ========================================================================

  ngOnInit(): void {
    this.initializeEnterKeyModes();
    this.setupContentChangeDebounce();
    this.subscribeToHistoryEvents();
  }

  ngAfterViewInit(): void {
    if (!this.editor) return;

    const editorEl = this.editor.nativeElement;

    this.initializeServices(editorEl);
    this.setInitialContent(editorEl);
    this.initializeEventHandling(editorEl);
    this.subscribeToTrackChangesState();
    this.tableOps.setEditorElement(editorEl);
    this.tableSelection.attach(editorEl);

    // Initial toolbar state update
    setTimeout(() => this.updateToolbarStates(), 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.eventsService.destroy();
    this.tableSelection.detach();
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Sets the output mode for content retrieval.
   */
  setOutputMode(mode: EditorOutputMode): void {
    this.outputMode = mode;
    this.emitContentChange();
  }

  /**
   * Gets the current editor content.
   */
  getContent(): string {
    if (!this.editor) return '';
    return this.trackChangesService.getContent(
      this.editor.nativeElement,
      this.outputMode
    );
  }

  // ========================================================================
  // TOOLBAR EVENT HANDLERS
  // ========================================================================

  /**
   * Called when any toolbar command is executed.
   */
  onCommandExecuted(): void {
    this.historyManager.saveBeforeCommand();

    setTimeout(() => {
      this.historyManager.saveAfterCommand();
      this.emitContentChange();
      this.updateToolbarStates();
    }, 0);
  }

  /**
 * Toggles track changes on/off.
 *
 * Matches CKEditor 4 Lite plugin behavior:
 * - If there are pending changes, user MUST resolve them before disabling
 * - Shows alert (not confirm) to inform user they need to resolve changes first
 * - Optional force parameter bypasses the pending changes check (for programmatic use)
 *
 * // Normal usage (from toolbar button) - respects pending changes check:
   // this.onToggleTrackChanges();

   // Programmatic usage - force disable even with pending changes:
   // this.onToggleTrackChanges({ force: true });
 *
 * @param options Optional configuration
 * @param options.force If true, skip pending changes check and force toggle
 */
  onToggleTrackChanges(options?: { force?: boolean }): void {
    const { isEnabled, pendingCount } = this.trackChangesState;
    const force = options?.force ?? false;

    // If tracking is enabled and there are pending changes (and not forced),
    // block disabling and show alert (matching CKEditor Lite plugin behavior)
    if (isEnabled && pendingCount > 0 && !force) {
      window.alert(
        'Your document contains some pending changes.\n' +
        'Please resolve them before turning off change tracking.'
      );
      return; // Do NOT proceed - user must accept/reject changes first
    }

    // Toggle tracking state
    if (isEnabled) {
      this.trackChangesService.disableTracking();
    } else {
      this.trackChangesService.enableTracking(this.editor.nativeElement);
    }

    this.eventsService.setTrackChangesEnabled(!isEnabled);
    this.historyManager.save();
  }

  /**
   * Shows/hides tracked changes.
   */
  onTrackChangesShow(visible: boolean): void {
    this.trackChangesService.toggleShowChanges(visible);
  }

  /**
   * Accepts all tracked changes.
   */
  onAcceptAllChanges(): void {
    if (this.trackChangesState.pendingCount === 0) return;

    const confirmed = window.confirm(
      `Accept all ${this.trackChangesState.pendingCount} changes? This cannot be undone.`
    );

    if (confirmed) {
      this.executeTrackChangesAction(() =>
        this.trackChangesService.acceptAllChanges()
      );
    }
  }

  /**
   * Rejects all tracked changes.
   */
  onRejectAllChanges(): void {
    if (this.trackChangesState.pendingCount === 0) return;

    const confirmed = window.confirm(
      `Reject all ${this.trackChangesState.pendingCount} changes? This cannot be undone.`
    );

    if (confirmed) {
      this.executeTrackChangesAction(() =>
        this.trackChangesService.rejectAllChanges()
      );
    }
  }

  /**
   * Accepts the currently selected change.
   */
  onAcceptOneChange(): void {
    if (this.trackChangesState.pendingCount === 0) {
      alert('No pending changes to accept.');
      return;
    }

    this.executeTrackChangesAction(() => {
      const accepted = this.trackChangesService.acceptChangeAtSelection();
      if (!accepted) {
        alert('Please click on a tracked change to accept it.');
      }
      return accepted;
    });
  }

  /**
   * Rejects the currently selected change.
   */
  onRejectOneChange(): void {
    if (this.trackChangesState.pendingCount === 0) {
      alert('No pending changes to reject.');
      return;
    }

    this.executeTrackChangesAction(() => {
      const rejected = this.trackChangesService.rejectChangeAtSelection();
      if (!rejected) {
        alert('Please click on a tracked change to reject it.');
      }
      return rejected;
    });
  }

  // ========================================================================
  // CONTEXT MENU HANDLERS
  // ========================================================================

  onContextMenuAcceptCurrent(changeId: string): void {
    this.executeTrackChangesAction(() =>
      this.trackChangesService.acceptChange(changeId)
    );
  }

  onContextMenuRejectCurrent(changeId: string): void {
    this.executeTrackChangesAction(() =>
      this.trackChangesService.rejectChange(changeId)
    );
  }

  onContextMenuAcceptAll(): void {
    this.executeTrackChangesAction(() =>
      this.trackChangesService.acceptAllChanges()
    );
  }

  onContextMenuRejectAll(): void {
    this.executeTrackChangesAction(() =>
      this.trackChangesService.rejectAllChanges()
    );
  }

  // ========================================================================
  // TABLE CONTEXT MENU HANDLERS
  // ========================================================================

  /**
   * Handle table context menu action
   */
  onTableContextAction(action: TableContextAction): void {
    if (action === 'tableProperties') {
      this.tableToolbar?.openTableProperties();
    } else if (action === 'cellProperties') {
      this.tableToolbar?.openCellProperties();
    }
    this.onCommandExecuted();
  }

  // ========================================================================
  // PRIVATE - INITIALIZATION
  // ========================================================================

  private initializeEnterKeyModes(): void {
    this.enterKeyService.configure(this.enterMode, this.shiftEnterMode);
  }

  private setupContentChangeDebounce(): void {
    this.contentChange$
      .pipe(
        debounceTime(CONTENT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe(content => this.contentChange.emit(content));
  }

  private subscribeToHistoryEvents(): void {
    this.historyManager.afterUndo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onAfterUndoRedo());

    this.historyManager.afterRedo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onAfterUndoRedo());

    this.historyManager.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.historyToolbar?.updateState());
  }

  private initializeServices(editorEl: HTMLElement): void {
    // Set editor element on all services
    this.selectionManager.setEditorElement(editorEl);
    this.historyManager.setEditorElement(editorEl);
    this.enterKeyService.setEditorElement(editorEl);

    // Connect track changes with enter key service
    this.trackChangesService.setEnterKeyService(this.enterKeyService);

    // Register callbacks
    this.historyManager.setTrackChangesReloadCallback(() => {
      if (this.trackChangesService.isTracking()) {
        this.trackChangesService.reload();
      }
    });

    this.trackChangesService.setContentChangeCallback(() => {
      if (!this.historyManager.isRestoring()) {
        this.historyManager.type();
        this.emitContentChange();
      }
    });
  }

  private setInitialContent(editorEl: HTMLElement): void {
    const sanitized = this.sanitizer.sanitizeContent(this.content);
    editorEl.innerHTML = sanitized;

    this.enterKeyService.ensureProperStructure();
    this.historyManager.initialize();
  }

  private initializeEventHandling(editorEl: HTMLElement): void {
    // Initialize events service
    this.eventsService.initialize(editorEl, this.trackChangesState.isEnabled);

    // Subscribe to events
    this.eventsService.onSelection
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateToolbarStates());

    this.eventsService.onContentChanged
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.emitContentChange());

    this.eventsService.onContextMenu
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => this.handleContextMenu(event));
  }

  private subscribeToTrackChangesState(): void {
    this.trackChangesService.getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.trackChangesState = state;
        if (!this.historyManager.isRestoring()) {
          this.emitContentChange();
        }
      });
  }

  // ========================================================================
  // PRIVATE - HELPERS
  // ========================================================================

  private emitContentChange(): void {
    if (!this.editor) return;
    if (this.historyManager.isRestoring()) return;

    this.content = this.getContent();
    this.contentChange$.next(this.content);
  }

  private updateToolbarStates(): void {
    this.textFormattingToolbar?.updateState();
    this.lineHeightToolbar?.updateState();
    this.historyToolbar?.updateState();
    this.tableToolbar?.updateState();
  }

  private onAfterUndoRedo(): void {
    this.emitContentChange();
    this.updateToolbarStates();
  }

  private executeTrackChangesAction(action: () => any): void {
    this.historyManager.saveBeforeCommand();
    action();
    this.historyManager.saveAfterCommand();
    this.emitContentChange();
  }

  private handleContextMenu(event: {
    position: { x: number; y: number };
    target: HTMLElement;
    shouldShowCustomMenu: boolean;
    menuType?: 'trackChanges' | 'table' | null;
  }): void {
    if (!event.shouldShowCustomMenu) return;

    // Determine menu type if not provided
    const menuType = event.menuType ?? this.determineMenuType(event.target);

    if (menuType === 'table') {
      this.tableContextMenu?.open(event.position.x, event.position.y);
    } else if (menuType === 'trackChanges') {
      const contextData = this.contextMenuService.getContextMenuData(event.target);
      this.trackChangesContextMenu?.openMenu(
        event.position.x,
        event.position.y,
        contextData
      );
    }
  }

  /**
   * Determine which context menu to show based on target element
   */
  private determineMenuType(target: HTMLElement): 'trackChanges' | 'table' | null {
    if (!this.editor) return null;

    let current: HTMLElement | null = target;
    const editorEl = this.editor.nativeElement;

    while (current && current !== editorEl) {
      // Check for table cell first
      if (current.tagName === 'TD' || current.tagName === 'TH') {
        return 'table';
      }
      // Check for track changes node
      if (current.classList?.contains('ice-ins') || current.classList?.contains('ice-del')) {
        return 'trackChanges';
      }
      current = current.parentElement;
    }

    // Fallback to track changes if enabled with pending changes
    if (this.trackChangesState.isEnabled && this.trackChangesState.pendingCount > 0) {
      return 'trackChanges';
    }

    return null;
  }
}