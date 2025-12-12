import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, debounceTime, takeUntil } from 'rxjs';

// Import toolbar components
import { TextFormattingToolbarComponent } from '../editor-toolbar/text-formatting-toolbar/text-formatting-toolbar.component';
import { AlignmentToolbarComponent } from '../editor-toolbar/alignment-toolbar/alignment-toolbar.component';
import { ListToolbarComponent } from '../editor-toolbar/list-toolbar/list-toolbar.component';
import { HistoryToolbarComponent } from '../editor-toolbar/history-toolbar/history-toolbar.component';
import { TableToolbarComponent } from '../editor-toolbar/table-toolbar/table-toolbar.component';
import { ImageToolbarComponent } from '../editor-toolbar/image-toolbar/image-toolbar.component';
import { LineHeightToolbarComponent } from '../editor-toolbar/line-height-toolbar/line-height-toolbar.component';
import { TrackChangesToolbarComponent } from '../track-changes/track-changes-toolbar/track-changes-toolbar.component';
import { TrackChangesContextMenuComponent } from '../track-changes/track-changes-context-menu/track-changes-context-menu.component';

// Import directive
import { TrackChangesTooltipDirective } from 'src/app/directives/track-changes-tooltip.directive';

// Import services
import { CommandExecutorService } from 'src/app/services/command-executor.service';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';
import { ContentSanitizerService } from 'src/app/services/content-sanitizer.service';
import { TrackChangesService } from 'src/app/services/track-changes';
import { TrackChangesContextMenuService } from 'src/app/services/track-changes/track-changes-context-menu.service';
import { HistoryManagerService } from 'src/app/services/history-manager.service';
import { EnterKeyService } from 'src/app/services/enter-key.service';

// Import entities
import {
  TrackChangesState,
  EditorOutputMode,
  EnterMode,
  DEFAULT_EDITOR_CONFIG
} from 'src/app/entities/editor-config';

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
    TrackChangesTooltipDirective
  ],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  providers: [EnterKeyService]
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('editor') editor!: ElementRef;
  @ViewChild('textFormattingToolbar') textFormattingToolbar!: TextFormattingToolbarComponent;
  @ViewChild('lineHeightToolbar') lineHeightToolbar!: LineHeightToolbarComponent;
  @ViewChild('historyToolbar') historyToolbar!: HistoryToolbarComponent;
  @ViewChild('trackChangesContextMenu') trackChangesContextMenu!: TrackChangesContextMenuComponent;

  @Input() content = '';
  @Input() height = '400px';
  @Input() placeholder = 'Start typing here...';
  @Input() outputMode: EditorOutputMode = EditorOutputMode.WithTrackedChanges;

  // Enter mode configuration inputs
  @Input() enterMode: EnterMode = DEFAULT_EDITOR_CONFIG.enterMode;
  @Input() shiftEnterMode: EnterMode = DEFAULT_EDITOR_CONFIG.shiftEnterMode;

  @Output() contentChange = new EventEmitter<string>();

  trackChangesVisible = true;

  private readonly CONTENT_DEBOUNCE_TIME = 300;
  private destroy$ = new Subject<void>();
  private contentChange$ = new Subject<string>();
  private selectionChangeListener?: () => void;
  private contextMenuListener?: (e: Event) => void;
  private rafId: number | undefined;
  private pendingUIUpdate = false;
  private trackChangesState: TrackChangesState = {
    isEnabled: false,
    isVisible: false,
    changes: [],
    pendingCount: 0
  };

  constructor(
    private commandExecutor: CommandExecutorService,
    private selectionManager: SelectionManagerService,
    private sanitizer: ContentSanitizerService,
    public trackChangesService: TrackChangesService,
    private contextMenuService: TrackChangesContextMenuService,
    public historyManager: HistoryManagerService,
    private enterKeyService: EnterKeyService
  ) { }

  ngOnInit(): void {
    // Configure enter key modes
    this.enterKeyService.configure(this.enterMode, this.shiftEnterMode);

    // Setup debounced content change emission
    this.contentChange$
      .pipe(
        debounceTime(this.CONTENT_DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(content => {
        this.contentChange.emit(content);
      });

    // Subscribe to history manager events for track changes integration
    this.historyManager.afterUndo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onAfterUndoRedo());

    this.historyManager.afterRedo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onAfterUndoRedo());

    // Subscribe to history state changes for toolbar updates
    this.historyManager.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.historyToolbar) {
          this.historyToolbar.updateState();
        }
      });
  }

  ngAfterViewInit(): void {
    if (!this.editor) return;

    const editorEl = this.editor.nativeElement;

    // Initialize services with editor element
    this.selectionManager.setEditorElement(editorEl);
    this.historyManager.setEditorElement(editorEl);
    this.enterKeyService.setEditorElement(editorEl);

    // Connect track changes service with enter key service
    this.trackChangesService.setEnterKeyService(this.enterKeyService);

    // CRITICAL: Register track changes reload callback
    this.historyManager.setTrackChangesReloadCallback(() => {
      if (this.trackChangesService.isTracking()) {
        this.trackChangesService.reload();
      }
    });

    // Register content change callback for track changes -> history integration
    this.trackChangesService.setContentChangeCallback(() => {
      if (!this.historyManager.isRestoring()) {
        this.historyManager.type();
        this.updateContentFromEditor();
      }
    });

    // Set initial content
    const sanitized = this.sanitizer.sanitizeContent(this.content);
    editorEl.innerHTML = sanitized;

    // Ensure proper initial structure based on enter mode
    this.enterKeyService.ensureProperStructure();

    // Initialize history manager with content (saves initial snapshot)
    this.historyManager.initialize();

    // Attach event listeners
    this.attachEditorListeners();
    this.initializeTrackChanges();

    // Initial toolbar state update
    setTimeout(() => {
      this.updateToolbarStates();
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelAnimationFrame();
    this.removeSelectionListener();
    this.removeContextMenuListener();
  }

  // ============================================================================
  // CONTEXT MENU HANDLING
  // ============================================================================

  /**
   * Handle context menu (right-click) on the editor
   */
  private onEditorContextMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const editorEl = this.editor?.nativeElement;

    // Only handle right-clicks inside the editor
    if (!editorEl || !editorEl.contains(target)) {
      return;
    }

    // Check if we should show the track changes context menu
    if (this.contextMenuService.shouldShowContextMenu(event)) {
      event.preventDefault();
      event.stopPropagation();

      // Get context data for the clicked element
      const contextData = this.contextMenuService.getContextMenuData(target);

      // Open the context menu at click position
      if (this.trackChangesContextMenu) {
        this.trackChangesContextMenu.openMenu(event.clientX, event.clientY, contextData);
      }
    }
  }

  /**
   * Handle accept current change from context menu
   */
  onContextMenuAcceptCurrent(changeId: string): void {
    this.historyManager.saveBeforeCommand();
    this.trackChangesService.acceptChange(changeId);
    this.historyManager.saveAfterCommand();
    this.updateContentFromEditor();
  }

  /**
   * Handle reject current change from context menu
   */
  onContextMenuRejectCurrent(changeId: string): void {
    this.historyManager.saveBeforeCommand();
    this.trackChangesService.rejectChange(changeId);
    this.historyManager.saveAfterCommand();
    this.updateContentFromEditor();
  }

  /**
   * Handle accept all changes from context menu
   */
  onContextMenuAcceptAll(): void {
    this.historyManager.saveBeforeCommand();
    this.trackChangesService.acceptAllChanges();
    this.historyManager.saveAfterCommand();
    this.updateContentFromEditor();
  }

  /**
   * Handle reject all changes from context menu
   */
  onContextMenuRejectAll(): void {
    this.historyManager.saveBeforeCommand();
    this.trackChangesService.rejectAllChanges();
    this.historyManager.saveAfterCommand();
    this.updateContentFromEditor();
  }

  // ============================================================================
  // LIFECYCLE HELPERS
  // ============================================================================

  /**
   * Called after undo/redo completes
   */
  private onAfterUndoRedo(): void {
    this.updateContentFromEditor();
    this.updateToolbarStates();
  }

  /**
   * Attach all editor event listeners
   */
  private attachEditorListeners(): void {
    const editorEl = this.editor.nativeElement;

    editorEl.addEventListener('input', this.onEditorInput.bind(this));
    editorEl.addEventListener('keydown', this.onEditorKeyDown.bind(this));

    this.selectionChangeListener = this.onSelectionChange.bind(this);
    document.addEventListener('selectionchange', this.selectionChangeListener);

    editorEl.addEventListener('focus', this.onEditorFocus.bind(this));
    editorEl.addEventListener('blur', this.onEditorBlur.bind(this));
    editorEl.addEventListener('click', this.onEditorClick.bind(this));

    // Context menu listener for track changes
    this.contextMenuListener = (e: Event) => this.onEditorContextMenu(e as MouseEvent);
    editorEl.addEventListener('contextmenu', this.contextMenuListener);
  }

  /**
   * Remove selection listener
   */
  private removeSelectionListener(): void {
    if (this.selectionChangeListener) {
      document.removeEventListener('selectionchange', this.selectionChangeListener);
    }
  }

  /**
   * Remove context menu listener
   */
  private removeContextMenuListener(): void {
    if (this.contextMenuListener && this.editor?.nativeElement) {
      this.editor.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
    }
  }

  /**
   * Handle editor input event
   */
  private onEditorInput(): void {
    if (this.historyManager.isRestoring()) {
      return;
    }

    if (!this.trackChangesService.isTracking()) {
      this.historyManager.type();
    }

    this.updateContentFromEditor();
  }

  /**
   * Handle keydown for shortcuts, navigation, and enter key
   */
  private onEditorKeyDown(event: KeyboardEvent): void {
    // Handle keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+B, etc.)
    this.handleKeyboardShortcuts(event);

    // Handle Enter key when track changes is DISABLED
    if ((event.key === 'Enter') && !this.trackChangesService.isTracking()) {
      event.preventDefault();
      this.handleEnterKey(event.shiftKey);
      return;
    }

    // Check for navigation keys
    if (this.isNavigationKey(event.key)) {
      this.historyManager.stopTyping();
    }
  }

  /**
   * Handle Enter key press when track changes is disabled
   */
  private handleEnterKey(isShiftKey: boolean): void {
    this.historyManager.saveBeforeCommand();

    const handled = this.enterKeyService.executeEnter(isShiftKey);

    if (handled) {
      this.historyManager.saveAfterCommand();
      this.updateContentFromEditor();
      this.scheduleUIUpdate();
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;

    const key = event.key.toLowerCase();
    const isFormattingShortcut = ['b', 'i', 'u', 'z', 'y'].includes(key);

    if (!isFormattingShortcut) return;

    event.preventDefault();
    event.stopPropagation();

    if (key === 'z') {
      if (event.shiftKey) {
        this.historyManager.redo();
      } else {
        this.historyManager.undo();
      }
      this.updateToolbarStates();
      return;
    }

    if (key === 'y') {
      this.historyManager.redo();
      this.updateToolbarStates();
      return;
    }

    this.historyManager.saveBeforeCommand();
    this.selectionManager.saveSelection();

    switch (key) {
      case 'b':
        this.commandExecutor.executeCommand('bold');
        break;
      case 'i':
        this.commandExecutor.executeCommand('italic');
        break;
      case 'u':
        this.commandExecutor.executeCommand('underline');
        break;
    }

    this.historyManager.saveAfterCommand();
    this.scheduleUIUpdate();
    this.updateContentFromEditor();
  }

  /**
   * Handle selection change
   */
  private onSelectionChange(): void {
    const editor = this.editor?.nativeElement;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    this.historyManager.update();
    this.scheduleUIUpdate();
  }

  /**
   * Handle editor focus
   */
  private onEditorFocus(): void {
    this.historyManager.setEnabled(true);
    this.scheduleUIUpdate();
  }

  /**
   * Handle editor blur
   */
  private onEditorBlur(): void {
    this.historyManager.stopTyping();
  }

  /**
   * Handle editor click
   */
  private onEditorClick(): void {
    this.historyManager.stopTyping();
    this.scheduleUIUpdate();
  }

  /**
   * Check if key is a navigation key
   */
  private isNavigationKey(key: string): boolean {
    const navigationKeys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown'
    ];
    return navigationKeys.includes(key);
  }

  /**
   * Schedule UI update using requestAnimationFrame
   */
  private scheduleUIUpdate(): void {
    if (this.pendingUIUpdate) return;

    this.pendingUIUpdate = true;
    this.rafId = requestAnimationFrame(() => {
      this.updateToolbarStates();
      this.pendingUIUpdate = false;
      this.rafId = undefined;
    });
  }

  /**
   * Update all toolbar component states
   */
  private updateToolbarStates(): void {
    const editor = this.editor?.nativeElement;
    if (!editor) return;

    if (this.textFormattingToolbar) {
      this.textFormattingToolbar.updateState();
    }

    if (this.lineHeightToolbar) {
      this.lineHeightToolbar.updateState();
    }

    if (this.historyToolbar) {
      this.historyToolbar.updateState();
    }
  }

  /**
   * Cancel pending animation frame
   */
  private cancelAnimationFrame(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
      this.pendingUIUpdate = false;
    }
  }

  /**
   * Called when any toolbar command is executed
   */
  onCommandExecuted(): void {
    this.historyManager.saveBeforeCommand();

    setTimeout(() => {
      this.historyManager.saveAfterCommand();
      this.updateContentFromEditor();
      this.scheduleUIUpdate();
    }, 0);
  }

  /**
   * Update content from editor and emit change
   */
  private updateContentFromEditor(): void {
    if (!this.editor) return;

    if (this.historyManager.isRestoring()) return;

    this.content = this.trackChangesService.getContent(
      this.editor.nativeElement,
      this.outputMode
    );

    this.contentChange$.next(this.content);
    this.scheduleUIUpdate();
  }

  /**
   * Initialize track changes functionality
   */
  private initializeTrackChanges(): void {
    this.trackChangesService
      .getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.trackChangesState = state;
        if (!this.historyManager.isRestoring()) {
          this.updateContentFromEditor();
        }
      });
  }

  // ============================================================================
  // TRACK CHANGES TOOLBAR HANDLERS
  // ============================================================================

  /**
   * Toggle track changes on/off
   */
  onToggleTrackChanges(): void {
    const state = this.trackChangesState;

    if (state.isEnabled) {
      if (state.pendingCount > 0) {
        const confirm = window.confirm(
          `There are ${state.pendingCount} pending changes. Disabling track changes will keep them but stop tracking new changes. Continue?`
        );
        if (!confirm) return;
      }
      this.trackChangesService.disableTracking();
    } else {
      if (!this.editor) return;
      this.trackChangesService.enableTracking(this.editor.nativeElement);
    }

    this.historyManager.save();
  }

  /**
   * Show/hide track changes
   */
  onTrackChangesShow(visible: boolean): void {
    this.trackChangesService.toggleShowChanges(visible);
  }

  /**
   * Accept all changes
   */
  onAcceptAllChanges(): void {
    if (this.trackChangesState.pendingCount === 0) return;

    const confirm = window.confirm(
      `Are you sure you want to accept all ${this.trackChangesState.pendingCount} changes? This action cannot be undone.`
    );

    if (confirm) {
      this.historyManager.saveBeforeCommand();
      this.trackChangesService.acceptAllChanges();
      this.historyManager.saveAfterCommand();
    }
  }

  /**
   * Reject all changes
   */
  onRejectAllChanges(): void {
    if (this.trackChangesState.pendingCount === 0) return;

    const confirm = window.confirm(
      `Are you sure you want to reject all ${this.trackChangesState.pendingCount} changes? This action cannot be undone.`
    );

    if (confirm) {
      this.historyManager.saveBeforeCommand();
      this.trackChangesService.rejectAllChanges();
      this.historyManager.saveAfterCommand();
    }
  }

  /**
   * Accept one change at selection
   */
  onAcceptOneChange(): void {
    if (this.trackChangesState.pendingCount === 0) {
      alert('No pending changes to accept.');
      return;
    }

    this.historyManager.saveBeforeCommand();
    const accepted = this.trackChangesService.acceptChangeAtSelection();

    if (accepted) {
      this.historyManager.saveAfterCommand();
    }

    if (!accepted) {
      alert('Please click on or select a tracked change to accept it.');
    }
  }

  /**
   * Reject one change at selection
   */
  onRejectOneChange(): void {
    if (this.trackChangesState.pendingCount === 0) {
      alert('No pending changes to reject.');
      return;
    }

    this.historyManager.saveBeforeCommand();
    const rejected = this.trackChangesService.rejectChangeAtSelection();

    if (rejected) {
      this.historyManager.saveAfterCommand();
    }

    if (!rejected) {
      alert('Please click on or select a tracked change to reject it.');
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Public API: Get editor content
   */
  getContent(): string {
    if (!this.editor) return '';
    return this.trackChangesService.getContent(
      this.editor.nativeElement,
      this.outputMode
    );
  }

  /**
   * Public API: Set editor content
   */
  setContent(content: string): void {
    const sanitized = this.sanitizer.sanitizeContent(content);
    this.content = sanitized;

    if (this.editor) {
      const wasEnabled = this.trackChangesState.isEnabled;

      if (wasEnabled) {
        this.trackChangesService.disableTracking();
      }

      this.editor.nativeElement.innerHTML = sanitized;

      this.historyManager.reset();
      this.historyManager.initialize();

      if (wasEnabled) {
        this.trackChangesService.enableTracking(this.editor.nativeElement);
      }

      this.contentChange$.next(sanitized);
    }
  }

  /**
   * Public API: Set output mode
   */
  setOutputMode(mode: EditorOutputMode): void {
    this.outputMode = mode;
    this.updateContentFromEditor();
  }

  /**
   * Public API: Get output mode
   */
  getOutputMode(): EditorOutputMode {
    return this.outputMode;
  }
}