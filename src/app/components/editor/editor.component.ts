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

// Import directive
import { TrackChangesTooltipDirective } from 'src/app/directives/track-changes-tooltip.directive';

// Import services
import { CommandExecutorService } from 'src/app/services/command-executor.service';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';
import { ContentSanitizerService } from 'src/app/services/content-sanitizer.service';
import { TrackChangesService } from 'src/app/services/track-changes.service';
import { HistoryManagerService } from 'src/app/services/history-manager.service';

// Import entities
import { TrackChangesState, EditorOutputMode } from 'src/app/entities/editor-config';

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
    TrackChangesTooltipDirective
  ],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('editor') editor!: ElementRef;
  @ViewChild('textFormattingToolbar') textFormattingToolbar!: TextFormattingToolbarComponent;
  @ViewChild('lineHeightToolbar') lineHeightToolbar!: LineHeightToolbarComponent;
  @ViewChild('historyToolbar') historyToolbar!: HistoryToolbarComponent;

  @Input() content = '<h2>Welcome to Custom WYSIWYG Editor</h2><p>Start editing...</p>';
  @Input() height = '400px';
  @Input() placeholder = 'Start typing here...';
  @Input() outputMode: EditorOutputMode = EditorOutputMode.WithTrackedChanges;

  @Output() contentChange = new EventEmitter<string>();

  trackChangesVisible = true;

  private readonly CONTENT_DEBOUNCE_TIME = 300;
  private destroy$ = new Subject<void>();
  private contentChange$ = new Subject<string>();
  private selectionChangeListener?: () => void;
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
    private trackChangesService: TrackChangesService,
    private historyManager: HistoryManagerService
  ) { }

  ngOnInit(): void {
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

    // CRITICAL: Register track changes reload callback
    // This is what LITE plugin does - it reloads tracker state after undo/redo
    this.historyManager.setTrackChangesReloadCallback(() => {
      if (this.trackChangesService.isTracking()) {
        this.trackChangesService.reload();
      }
    });

    // NEW: Register content change callback for track changes -> history integration
    // When track changes modifies content (bypassing native input events),
    // we need to notify the history manager to record the change for undo/redo
    this.trackChangesService.setContentChangeCallback(() => {
      if (!this.historyManager.isRestoring()) {
        this.historyManager.type();
        this.updateContentFromEditor();
      }
    });

    // Set initial content
    const sanitized = this.sanitizer.sanitizeContent(this.content);
    editorEl.innerHTML = sanitized;

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
  }

  /**
   * Called after undo/redo completes
   * This mirrors CKEditor's afterUndo/afterRedo events
   */
  private onAfterUndoRedo(): void {
    // Update content output
    this.updateContentFromEditor();
    // Update toolbar states
    this.updateToolbarStates();
  }

  /**
   * Attach all editor event listeners
   */
  private attachEditorListeners(): void {
    const editorEl = this.editor.nativeElement;

    // Input event - fires on content changes (when track changes is disabled)
    editorEl.addEventListener('input', this.onEditorInput.bind(this));

    // Keydown - for shortcuts and special keys
    editorEl.addEventListener('keydown', this.onEditorKeyDown.bind(this));

    // Selection change listener
    this.selectionChangeListener = this.onSelectionChange.bind(this);
    document.addEventListener('selectionchange', this.selectionChangeListener);

    // Focus/blur for state management
    editorEl.addEventListener('focus', this.onEditorFocus.bind(this));
    editorEl.addEventListener('blur', this.onEditorBlur.bind(this));

    // Click for toolbar updates
    editorEl.addEventListener('click', this.onEditorClick.bind(this));
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
   * Handle editor input event
   * Note: This only fires when track changes is DISABLED
   * When track changes is enabled, TrackChangesService intercepts beforeinput
   * and calls historyManager.type() via the content change callback
   */
  private onEditorInput(): void {
    // Don't record if we're in the middle of undo/redo restore
    if (this.historyManager.isRestoring()) {
      return;
    }

    // Only notify history manager if track changes is NOT enabled
    // (when enabled, TrackChangesService handles this via callback)
    if (!this.trackChangesService.isTracking()) {
      this.historyManager.type();
    }

    // Update output content
    this.updateContentFromEditor();
  }

  /**
   * Handle keydown for shortcuts and navigation
   */
  private onEditorKeyDown(event: KeyboardEvent): void {
    // Handle keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+B, etc.)
    this.handleKeyboardShortcuts(event);

    // Check for navigation keys (arrows, home, end, etc.)
    if (this.isNavigationKey(event.key)) {
      // Navigation stops typing mode
      this.historyManager.stopTyping();
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

    // CRITICAL: Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();

    // Handle undo/redo
    if (key === 'z') {
      if (event.shiftKey) {
        // Ctrl+Shift+Z = Redo
        this.historyManager.redo();
      } else {
        // Ctrl+Z = Undo
        this.historyManager.undo();
      }
      this.updateToolbarStates();
      return;
    }

    if (key === 'y') {
      // Ctrl+Y = Redo
      this.historyManager.redo();
      this.updateToolbarStates();
      return;
    }

    // For formatting commands, save snapshot before and after
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

    // Only process if selection is within editor
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    // Update selection in history manager (for selection-only snapshots)
    this.historyManager.update();

    // Schedule UI update
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
    // Stop typing and save final state
    this.historyManager.stopTyping();
  }

  /**
   * Handle editor click
   */
  private onEditorClick(): void {
    // Clicks stop typing mode (navigation)
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
    // Save snapshot before and after commands
    this.historyManager.saveBeforeCommand();

    // Use setTimeout to capture state after command executes
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

    // Don't emit during restore operations
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
        // Don't call updateContentFromEditor during restore
        if (!this.historyManager.isRestoring()) {
          this.updateContentFromEditor();
        }
      });
  }

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

    // Save snapshot after toggling track changes
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

      // Reset history when content is set programmatically
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