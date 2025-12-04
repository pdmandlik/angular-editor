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
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject, debounceTime } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ImageUploadService } from 'src/app/services/image-upload.service';
import { TrackChangesService } from 'src/app/services/track-changes.service';
import { TableDialogComponent } from '../dialogs/table-dialog/table-dialog.component';
import { ImageUploadDialogComponent } from '../dialogs/image-upload-dialog/image-upload-dialog.component';
import { TrackChangesToolbarComponent } from '../track-changes/track-changes-toolbar/track-changes-toolbar.component';
import { TrackChangesTooltipDirective } from 'src/app/directives/track-changes-tooltip.directive';
import { TrackChangesState, EditorOutputMode } from 'src/app/entities/editor-config';

@Component({
  selector: 'cg-editor',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatDividerModule,
    MatSelectModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatMenuModule,
    TrackChangesToolbarComponent,
    TrackChangesTooltipDirective
  ],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly OVERLAY_HIDE_DELAY = 200;
  private readonly CONTENT_DEBOUNCE_TIME = 300;
  private readonly MAX_TABLE_ROWS = 20;
  private readonly MAX_TABLE_COLS = 20;
  private readonly MAX_IMAGE_SIZE_MB = 5;
  private readonly MAX_IMAGE_DIMENSION = 10000;
  private readonly BLOCK_ELEMENTS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'LI'];
  
  @ViewChild('editor') editor!: ElementRef;
  @Input() content = '<h2>Welcome to Custom WYSIWYG Editor</h2><p>This is a fully-custom WYSIWYG editor built with Angular Material and ContentEditable API.</p><p>Try out all the features in the toolbar above!</p>';
  @Input() height = '400px';
  @Input() placeholder = 'Start typing here...';
  @Input() outputMode: EditorOutputMode = EditorOutputMode.WithTrackedChanges;
  
  @Output() contentChange = new EventEmitter<string>();

  lineHeights: string[] = ['1.0', '1.2', '1.5', '1.8', '2.0', '2.5', '3.0'];
  lineHeight = new FormControl('1.5');

  boldActive = false;
  italicActive = false;
  underlineActive = false;
  strikeActive = false;
  subActive = false;
  superActive = false;

  readonly maxGridRows = 10;
  readonly maxGridCols = 10;
  previewRows = 1;
  previewCols = 1;
  showGrid = false;
  
  gridRows: number[] = [];
  gridCols: number[] = [];

  showLineHeightGridFlag = false;
  trackChangesVisible = true;

  private savedRange: Range | null = null;
  private gridTimeout: ReturnType<typeof setTimeout> | undefined;
  private lineHeightGridTimeout: ReturnType<typeof setTimeout> | undefined;
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
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private imageUploadService: ImageUploadService,
    private trackChangesService: TrackChangesService
  ) {}

  ngOnInit(): void {
    this.gridRows = Array(this.maxGridRows).fill(0).map((_, i) => i);
    this.gridCols = Array(this.maxGridCols).fill(0).map((_, i) => i);
    
    this.contentChange$
      .pipe(
        debounceTime(this.CONTENT_DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(content => {
        this.contentChange.emit(content);
      });
    
    if (this.content) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.sanitizeContent(this.content);
      const initialContent = this.trackChangesService.getContent(tempDiv, this.outputMode);
      setTimeout(() => {
        this.contentChange.emit(initialContent);
      }, 0);
    }
  }

  ngAfterViewInit(): void {
    if (!this.editor) return;

    this.editor.nativeElement.innerHTML = this.sanitizeContent(this.content);
    this.initializeTrackChanges();

    this.editor.nativeElement.addEventListener('input', () => {
      this.updateContentFromEditor();
    });

    this.selectionChangeListener = () => {
      this.scheduleUIUpdate();
      this.saveCurrentSelection();
    };
    document.addEventListener('selectionchange', this.selectionChangeListener);

    this.editor.nativeElement.addEventListener('click', () => {
      this.scheduleUIUpdate();
      this.saveCurrentSelection();
    });

    this.editor.nativeElement.addEventListener('mouseup', () => {
      this.saveCurrentSelection();
    });

    // FIXED: Handle keyboard shortcuts on keydown, not keyup
    this.editor.nativeElement.addEventListener('keydown', (e: KeyboardEvent) => {
      this.handleKeyboardShortcuts(e);
    });

    this.editor.nativeElement.addEventListener('keyup', (e: KeyboardEvent) => {
      this.saveCurrentSelection();
    });
  }

  ngOnDestroy(): void {
    if (this.selectionChangeListener) {
      document.removeEventListener('selectionchange', this.selectionChangeListener);
    }
    
    this.clearTimeout(this.gridTimeout);
    this.clearTimeout(this.lineHeightGridTimeout);
    this.cancelAnimationFrame();
    
    this.destroy$.next();
    this.destroy$.complete();
    this.contentChange$.complete();
  }

  private clearTimeout(timeout: ReturnType<typeof setTimeout> | undefined): void {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }

  private cancelAnimationFrame(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
      this.pendingUIUpdate = false;
    }
  }

  private saveCurrentSelection(): void {
    const selection = window.getSelection();
    if (selection?.rangeCount && this.editor) {
      const range = selection.getRangeAt(0);
      if (this.editor.nativeElement.contains(range.commonAncestorContainer)) {
        this.savedRange = range.cloneRange();
      }
    }
  }

  private restoreSelection(range: Range | null = this.savedRange): void {
    if (!range) return;
    
    try {
      if (!this.editor?.nativeElement.contains(range.commonAncestorContainer)) {
        this.savedRange = null;
        return;
      }

      if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
        this.savedRange = null;
        return;
      }

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      this.savedRange = null;
    }
  }

  private isSelectionValid(): boolean {
    if (!this.savedRange) return false;
    
    try {
      return this.editor?.nativeElement.contains(this.savedRange.commonAncestorContainer) &&
             document.contains(this.savedRange.startContainer) &&
             document.contains(this.savedRange.endContainer);
    } catch {
      return false;
    }
  }

  private scheduleUIUpdate(): void {
    if (this.pendingUIUpdate) return;
    
    this.pendingUIUpdate = true;
    this.rafId = requestAnimationFrame(() => {
      this.updateToolbarState();
      this.updateLineHeightUI();
      this.pendingUIUpdate = false;
      this.rafId = undefined;
    });
  }

  private updateToolbarState(): void {
    const editor = this.editor?.nativeElement;
    if (!editor || (document.activeElement !== editor && !editor.contains(document.activeElement))) {
      return;
    }

    try {
      this.boldActive = document.queryCommandState('bold');
      this.italicActive = document.queryCommandState('italic');
      this.underlineActive = document.queryCommandState('underline');
      this.strikeActive = document.queryCommandState('strikeThrough');
      this.subActive = document.queryCommandState('subscript');
      this.superActive = document.queryCommandState('superscript');
    } catch (error) {
      // Command state check failed - ignore
    }
  }

  private updateLineHeightUI(): void {
    const editor = this.editor?.nativeElement;
    if (!editor || (document.activeElement !== editor && !editor.contains(document.activeElement))) {
      return;
    }

    const currentValue = this.getCurrentLineHeightValue();
    this.lineHeight.setValue(currentValue || '1.5', { emitEvent: false });
  }

  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;

    const key = event.key.toLowerCase();
    
    // Check if it's a formatting shortcut we handle
    const isFormattingShortcut = ['b', 'i', 'u', 'z', 'y'].includes(key);
    
    if (!isFormattingShortcut) return;
    
    // CRITICAL: Prevent default behavior AND stop propagation
    event.preventDefault();
    event.stopPropagation();
    
    // Save selection before executing command
    this.saveCurrentSelection();
    
    // Execute the appropriate command
    switch (key) {
      case 'b':
        this.formatBold();
        break;
      case 'i':
        this.formatItalic();
        break;
      case 'u':
        this.formatUnderline();
        break;
      case 'z':
        event.shiftKey ? this.redoAction() : this.undoAction();
        break;
      case 'y':
        this.redoAction();
        break;
    }
    
    // Update UI state immediately
    this.scheduleUIUpdate();
  }

  private sanitizeContent(content: string): string {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/style\s*=\s*["'][^"']*expression\s*\([^"']*\)["']/gi, '')
      .replace(/style\s*=\s*["'][^"']*javascript:[^"']*["']/gi, '')
      .replace(/data-[a-z-]+\s*=\s*["'][^"']*javascript:[^"']*["']/gi, '');
  }

  executeCommand(command: string, value: string = '', showDefaultUI = false): void {
    const savedRange = this.savedRange || this.saveSelection();
    if (!savedRange || !this.isSelectionValid()) {
      // FIXED: For keyboard shortcuts, try to get current selection
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const currentRange = selection.getRangeAt(0);
        if (this.editor?.nativeElement.contains(currentRange.commonAncestorContainer)) {
          this.savedRange = currentRange.cloneRange();
        } else {
          this.savedRange = null;
          return;
        }
      } else {
        this.savedRange = null;
        return;
      }
    }

    try {
      if (!document.queryCommandSupported(command)) {
        return;
      }

      // FIXED: Ensure selection is active before command
      this.restoreSelection(this.savedRange);
      
      document.execCommand(command, showDefaultUI, value);
      this.updateContentFromEditor();
      
      // Save the new selection state after command
      this.saveCurrentSelection();
      this.scheduleUIUpdate();
    } catch (error) {
      // Command execution failed
    }
  }

  private saveSelection(): Range | null {
    const selection = window.getSelection();
    return selection?.rangeCount ? selection.getRangeAt(0) : null;
  }

  formatBold(): void { this.executeCommand('bold'); }
  formatItalic(): void { this.executeCommand('italic'); }
  formatUnderline(): void { this.executeCommand('underline'); }
  formatStrikethrough(): void { this.executeCommand('strikeThrough'); }
  formatSubscript(): void { this.executeCommand('subscript'); }
  formatSuperscript(): void { this.executeCommand('superscript'); }

  alignLeft(): void { this.executeCommand('justifyLeft'); }
  alignCenter(): void { this.executeCommand('justifyCenter'); }
  alignRight(): void { this.executeCommand('justifyRight'); }
  alignJustify(): void { this.executeCommand('justifyFull'); }

  insertUnorderedList(): void { this.executeCommand('insertUnorderedList'); }
  insertOrderedList(): void { this.executeCommand('insertOrderedList'); }

  undoAction(): void { this.executeCommand('undo'); }
  redoAction(): void { this.executeCommand('redo'); }
  
  selectAllText(): void {
    if (!this.editor) return;
    
    const editor = this.editor.nativeElement;
    editor.focus();

    const range = document.createRange();
    range.selectNodeContents(editor);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.scheduleUIUpdate();
  }

  insertTable(): void {
    const dialogRef = this.dialog.open(TableDialogComponent, {
      width: '400px',
      data: { maxRows: this.MAX_TABLE_ROWS, maxCols: this.MAX_TABLE_COLS }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.rows && result?.cols) {
        this.generateTable(result.rows, result.cols);
      }
    });
  }

  private generateTable(rows: number, cols: number): void {
    if (rows > this.MAX_TABLE_ROWS || cols > this.MAX_TABLE_COLS || rows < 1 || cols < 1) {
      return;
    }

    const tableHTML = this.createTableHTML(rows, cols);
    this.executeCommand('insertHTML', tableHTML);
  }

  private createTableHTML(rows: number, cols: number): string {
    let html = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 8px 0; border: 1px solid #ddd;">';

    for (let i = 0; i < rows; i++) {
      html += '<tr style="border: 1px solid #ddd;">';
      for (let j = 0; j < cols; j++) {
        html += '<td style="padding: 8px; border: 1px solid #ddd; min-width: 50px; background-color: #fff;">&nbsp;</td>';
      }
      html += '</tr>';
    }

    html += '</table>';
    return html;
  }

  getGridRows(): number[] { return this.gridRows; }
  getGridCols(): number[] { return this.gridCols; }

  isCellSelected(rowIndex: number, colIndex: number): boolean {
    return rowIndex < this.previewRows && colIndex < this.previewCols;
  }

  onCellHover(rowIndex: number, colIndex: number): void {
    this.previewRows = rowIndex + 1;
    this.previewCols = colIndex + 1;
  }

  showTableGrid(): void {
    this.saveCurrentSelection();
    this.clearTimeout(this.gridTimeout);
    this.gridTimeout = undefined;
    this.showGrid = true;
    this.previewRows = 1;
    this.previewCols = 1;
  }

  hideTableGrid(): void {
    this.clearTimeout(this.gridTimeout);
    
    this.gridTimeout = setTimeout(() => {
      this.showGrid = false;
      this.previewRows = 1;
      this.previewCols = 1;
      this.gridTimeout = undefined;
    }, this.OVERLAY_HIDE_DELAY);
  }

  keepGridVisible(): void {
    this.clearTimeout(this.gridTimeout);
    this.gridTimeout = undefined;
  }

  generateTableFromOverlay(rows: number, cols: number): void {
    if (!this.editor) return;
    
    this.showGrid = false;
    this.clearTimeout(this.gridTimeout);
    this.gridTimeout = undefined;

    if (this.savedRange && this.isSelectionValid()) {
      this.restoreSelection(this.savedRange);
    } else {
      this.editor.nativeElement.focus();
      const range = document.createRange();
      const selection = window.getSelection();
      
      if (this.editor.nativeElement.lastChild) {
        range.setStartAfter(this.editor.nativeElement.lastChild);
        range.collapse(true);
      } else {
        range.selectNodeContents(this.editor.nativeElement);
        range.collapse(false);
      }
      
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    const tableHTML = this.createTableHTML(rows, cols);
    this.insertHTMLAtSelection(tableHTML);

    this.previewRows = 1;
    this.previewCols = 1;
  }

  private insertHTMLAtSelection(html: string): void {
    const selection = window.getSelection();
    
    if (!selection || !this.editor) return;

    const editor = this.editor.nativeElement;
    
    try {
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        if (editor.contains(range.startContainer)) {
          document.execCommand('insertHTML', false, html);
        } else {
          const newRange = document.createRange();
          newRange.selectNodeContents(editor);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
          document.execCommand('insertHTML', false, html);
        }
      }

      this.updateContentFromEditor();
    } catch (error) {
      // HTML insertion failed
    }
  }

  insertImage(): void {
    this.saveCurrentSelection();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (event: any) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validation = this.imageUploadService.validateImageFile(file, this.MAX_IMAGE_SIZE_MB);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      let previewUrl: string | null = null;

      try {
        const dimensions = await this.imageUploadService.getImageDimensions(file);

        if (dimensions.width > this.MAX_IMAGE_DIMENSION || dimensions.height > this.MAX_IMAGE_DIMENSION) {
          alert(`Image dimensions too large. Maximum allowed: ${this.MAX_IMAGE_DIMENSION}px`);
          return;
        }

        previewUrl = URL.createObjectURL(file);

        if (!file || !previewUrl || !dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          alert('Invalid image file');
          return;
        }

        const dialogRef = this.dialog.open(ImageUploadDialogComponent, {
          width: '700px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          disableClose: true,
          panelClass: 'image-upload-dialog-panel',
          autoFocus: false,
          data: {
            file,
            previewUrl,
            dimensions
          }
        });

        dialogRef.afterClosed().subscribe({
          next: (result) => {
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
              previewUrl = null;
            }

            if (result && result.url) {
              this.insertImageWithProperties(result.url, result.config);
            }
          },
          error: () => {
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
              previewUrl = null;
            }
          }
        });

      } catch (error) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          previewUrl = null;
        }
        alert('Error processing image file');
      }
    };

    input.click();
  }

  private insertImageWithProperties(url: string, config: any): void {
    if (this.savedRange && this.isSelectionValid()) {
      this.restoreSelection(this.savedRange);
    }
    
    if (this.editor) {
      this.editor.nativeElement.focus();
    }

    const sanitizedUrl = this.sanitizeImageUrl(url);
    if (!sanitizedUrl) {
      return;
    }

    const styles: string[] = [];
    
    if (config.width !== null && config.widthUnit !== 'auto') {
      styles.push(`width: ${config.width}${config.widthUnit}`);
    }
    if (config.height !== null && config.heightUnit !== 'auto') {
      styles.push(`height: ${config.height}${config.heightUnit}`);
    }

    if (config.alignment === 'left') {
      styles.push('float: left');
    } else if (config.alignment === 'right') {
      styles.push('float: right');
    } else if (config.alignment === 'center') {
      styles.push('display: block', 'margin-left: auto', 'margin-right: auto');
    }

    styles.push(`vertical-align: ${config.verticalAlign}`);

    if (config.hspace > 0) {
      styles.push(`margin-left: ${config.hspace}px`, `margin-right: ${config.hspace}px`);
    }
    if (config.vspace > 0) {
      styles.push(`margin-top: ${config.vspace}px`, `margin-bottom: ${config.vspace}px`);
    }

    if (config.border > 0 && config.borderStyle !== 'none') {
      styles.push(`border: ${config.border}px ${config.borderStyle} ${config.borderColor}`);
    }

    const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
    const altAttr = config.altText ? ` alt="${this.escapeHtml(config.altText)}"` : ' alt=""';
    
    const imageHTML = `<img src="${sanitizedUrl}"${altAttr}${styleAttr}>`;
    
    this.insertHTMLAtSelection(imageHTML);
  }

  private sanitizeImageUrl(url: string): string | null {
    try {
      if (url.startsWith('data:image/')) {
        return url;
      }
      
      const urlObj = new URL(url);
      if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
        return url;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLineHeightGrid(): void {
    this.saveCurrentSelection();
    this.clearTimeout(this.lineHeightGridTimeout);
    this.lineHeightGridTimeout = undefined;
    this.showLineHeightGridFlag = true;
  }

  hideLineHeightGrid(): void {
    this.clearTimeout(this.lineHeightGridTimeout);
    
    this.lineHeightGridTimeout = setTimeout(() => {
      this.showLineHeightGridFlag = false;
      this.lineHeightGridTimeout = undefined;
    }, this.OVERLAY_HIDE_DELAY);
  }

  keepLineHeightGridVisible(): void {
    this.clearTimeout(this.lineHeightGridTimeout);
    this.lineHeightGridTimeout = undefined;
  }

  selectLineHeight(height: string): void {
    const currentValue = this.getCurrentLineHeightValue();

    if (currentValue === height) {
      this.removeLineHeightStyle();
    } else {
      this.applyLineHeight(height);
    }
    
    this.showLineHeightGridFlag = false;
    this.clearTimeout(this.lineHeightGridTimeout);
    this.lineHeightGridTimeout = undefined;
  }

  private applyLineHeight(height: string): void {
    if (this.savedRange && this.isSelectionValid()) {
      this.restoreSelection(this.savedRange);
    }

    if (this.editor) {
      this.editor.nativeElement.focus();
    }

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    
    if (range.collapsed) {
      let node: Node | null = range.startContainer;
      while (node && node !== this.editor?.nativeElement) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (this.BLOCK_ELEMENTS.includes(element.tagName)) {
            element.style.lineHeight = height;
            this.lineHeight.setValue(height, { emitEvent: false });
            this.updateContentFromEditor();
            return;
          }
        }
        node = node.parentElement;
      }
      
      const div = document.createElement('div');
      div.style.lineHeight = height;
      range.insertNode(div);
      range.selectNodeContents(div);
      selection.removeAllRanges();
      selection.addRange(range);
      
      this.lineHeight.setValue(height, { emitEvent: false });
      this.updateContentFromEditor();
      return;
    }

    const elements = this.getBlockElementsInRange(range);

    if (elements.length > 0) {
      elements.forEach(element => {
        element.style.lineHeight = height;
      });
    } else {
      const div = document.createElement('div');
      div.style.lineHeight = height;
      
      try {
        range.surroundContents(div);
      } catch (e) {
        const fragment = range.extractContents();
        div.appendChild(fragment);
        range.insertNode(div);
      }
    }

    this.lineHeight.setValue(height, { emitEvent: false });
    this.updateContentFromEditor();
    
    this.restoreSelection(range);
    this.editor?.nativeElement.focus();
  }

  private removeLineHeightStyle(): void {
    if (this.savedRange && this.isSelectionValid()) {
      this.restoreSelection(this.savedRange);
    }

    if (this.editor) {
      this.editor.nativeElement.focus();
    }

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const elements = this.getBlockElementsInRange(range);

    elements.forEach(element => {
      if (element.style.lineHeight) {
        element.style.lineHeight = '';
        
        if (!element.getAttribute('style')?.trim()) {
          element.removeAttribute('style');
        }
      }
    });

    this.lineHeight.setValue('1.5', { emitEvent: false });
    this.updateContentFromEditor();
    
    this.restoreSelection(range);
    this.editor?.nativeElement.focus();
  }

  private getBlockElementsInRange(range: Range): HTMLElement[] {
    let node: Node | null = range.commonAncestorContainer;

    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    if (node === this.editor?.nativeElement) {
      const selector = this.BLOCK_ELEMENTS.join(',');
      const allBlocks = this.editor.nativeElement.querySelectorAll(selector);
      
      const selectedBlocks: HTMLElement[] = [];
      allBlocks.forEach((block: Element) => {
        const blockRange = document.createRange();
        try {
          blockRange.selectNodeContents(block);
          
          if (this.rangesIntersect(range, blockRange)) {
            selectedBlocks.push(block as HTMLElement);
          }
        } catch (error) {
          // Range intersection check failed
        }
      });
      
      return selectedBlocks;
    }

    const elements: HTMLElement[] = [];
    let currentNode = node;
    
    while (currentNode && currentNode !== this.editor?.nativeElement) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as HTMLElement;
        if (this.BLOCK_ELEMENTS.includes(element.tagName)) {
          elements.push(element);
          break;
        }
      }
      currentNode = currentNode.parentElement;
    }

    if (elements.length === 0 && node) {
      let parentNode = node.parentElement;
      while (parentNode && parentNode !== this.editor?.nativeElement) {
        if (this.BLOCK_ELEMENTS.includes(parentNode.tagName)) {
          elements.push(parentNode);
          break;
        }
        parentNode = parentNode.parentElement;
      }
    }

    return elements;
  }

  private rangesIntersect(range1: Range, range2: Range): boolean {
    try {
      return range1.compareBoundaryPoints(Range.END_TO_START, range2) <= 0 &&
             range1.compareBoundaryPoints(Range.START_TO_END, range2) >= 0;
    } catch (error) {
      return false;
    }
  }

  private getCurrentLineHeightValue(): string {
    const range = this.savedRange || this.saveSelection();
    if (!range) return '';

    let node: Node | null = range.commonAncestorContainer;

    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    while (node && node !== this.editor?.nativeElement) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const lineHeight = element.style.lineHeight;
        
        if (lineHeight && lineHeight !== 'normal' && lineHeight !== '') {
          return this.normalizeLineHeight(lineHeight, element);
        }
      }
      node = node.parentElement;
    }
    
    return '';
  }

  private normalizeLineHeight(lineHeight: string, element: HTMLElement): string {
    if (/^[\d.]+$/.test(lineHeight)) {
      return lineHeight;
    }

    if (lineHeight.endsWith('px')) {
      try {
        const computedStyle = window.getComputedStyle(element);
        const fontSize = parseFloat(computedStyle.fontSize);
        const lineHeightPx = parseFloat(lineHeight);
        
        if (fontSize > 0 && !isNaN(lineHeightPx)) {
          const relative = (lineHeightPx / fontSize).toFixed(1);
          const match = this.lineHeights.find(h => 
            Math.abs(parseFloat(h) - parseFloat(relative)) < 0.1
          );
          return match || relative;
        }
      } catch (error) {
        // Normalization failed
      }
    }

    return lineHeight;
  }

  private initializeTrackChanges(): void {
    this.trackChangesService.getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.trackChangesState = state;
        this.updateContentFromEditor();
      });
  }

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
  }

  onTrackChangesShow(visible: boolean): void {
    this.trackChangesService.toggleShowChanges(visible);
  }

  onAcceptAllChanges(): void {
    const state = this.trackChangesState;

    if (state.pendingCount === 0) return;

    const confirm = window.confirm(
      `Are you sure you want to accept all ${state.pendingCount} changes? This action cannot be undone.`
    );

    if (confirm) {
      this.trackChangesService.acceptAllChanges();
    }
  }

  onRejectAllChanges(): void {
    const state = this.trackChangesState;

    if (state.pendingCount === 0) return;

    const confirm = window.confirm(
      `Are you sure you want to reject all ${state.pendingCount} changes? This action cannot be undone.`
    );

    if (confirm) {
      this.trackChangesService.rejectAllChanges();
    }
  }

  onAcceptOneChange(): void {
    const state = this.trackChangesState;

    if (state.pendingCount === 0) {
      alert('No pending changes to accept.');
      return;
    }

    const accepted = this.trackChangesService.acceptChangeAtSelection();

    if (!accepted) {
      alert('Please click on or select a tracked change to accept it.');
    }
  }

  onRejectOneChange(): void {
    const state = this.trackChangesState;

    if (state.pendingCount === 0) {
      alert('No pending changes to reject.');
      return;
    }

    const rejected = this.trackChangesService.rejectChangeAtSelection();

    if (!rejected) {
      alert('Please click on or select a tracked change to reject it.');
    }
  }

  private updateContentFromEditor(): void {
    if (this.editor) {
      this.content = this.trackChangesService.getContent(
        this.editor.nativeElement, 
        this.outputMode
      );
      this.contentChange.emit(this.content);
      this.contentChange$.next(this.content);
    }
  }

  getContent(): string {
    if (!this.editor) return '';

    return this.trackChangesService.getContent(
      this.editor.nativeElement,
      this.outputMode
    );
  }

  setContent(content: string): void {
    const sanitized = this.sanitizeContent(content);
    this.content = sanitized;

    if (this.editor) {
      const wasEnabled = this.trackChangesState.isEnabled;

      if (wasEnabled) {
        this.trackChangesService.disableTracking();
      }

      this.editor.nativeElement.innerHTML = sanitized;

      if (wasEnabled) {
        this.trackChangesService.enableTracking(this.editor.nativeElement);
      }

      this.contentChange$.next(sanitized);
    }
  }

  setOutputMode(mode: EditorOutputMode): void {
    this.outputMode = mode;
    this.updateContentFromEditor();
  }

  getOutputMode(): EditorOutputMode {
    return this.outputMode;
  }
}