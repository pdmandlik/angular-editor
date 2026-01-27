import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';

/**
 * Alignment Toolbar Component
 * Handles: Left, Center, Right, Justify
 * 
 * Uses mousedown + preventDefault pattern to preserve selection
 * when toolbar buttons are clicked.
 */
@Component({
  selector: 'ed-alignment-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      matTooltip="Align Left"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="alignLeft()"
      [class.active]="currentAlignment === 'left'"
      type="button">
      <mat-icon>format_align_left</mat-icon>
    </button>
    <button
      matTooltip="Align Center"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="alignCenter()"
      [class.active]="currentAlignment === 'center'"
      type="button">
      <mat-icon>format_align_center</mat-icon>
    </button>
    <button
      matTooltip="Align Right"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="alignRight()"
      [class.active]="currentAlignment === 'right'"
      type="button">
      <mat-icon>format_align_right</mat-icon>
    </button>
    <button
      matTooltip="Justify"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="alignJustify()"
      [class.active]="currentAlignment === 'justify'"
      type="button">
      <mat-icon>format_align_justify</mat-icon>
    </button>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    button.active {
      background-color: rgba(0, 0, 0, 0.1);
    }
  `]
})
export class AlignmentToolbarComponent {
  @Output() commandExecuted = new EventEmitter<void>();

  currentAlignment: 'left' | 'center' | 'right' | 'justify' | '' = '';
  private capturedRange: Range | null = null;

  constructor(private selectionManager: SelectionManagerService) { }

  /**
   * Capture selection on mousedown BEFORE focus changes
   * This is critical - by the time click fires, selection may be lost
   */
  onMouseDown(event: MouseEvent): void {
    // Prevent default to stop focus from moving away from editor
    event.preventDefault();

    // Capture the current selection immediately while it's still valid
    const selection = window.getSelection();
    const editorElement = this.selectionManager.getEditorElement();

    if (selection && selection.rangeCount > 0 && editorElement) {
      const range = selection.getRangeAt(0);

      // Verify selection is within editor
      if (editorElement.contains(range.commonAncestorContainer)) {
        // Clone the range to preserve it
        this.capturedRange = range.cloneRange();
        // Also save to selection manager as backup
        this.selectionManager.saveSelection();
      }
    }
  }

  alignLeft(): void {
    this.executeAlignmentCommand('justifyLeft', 'left');
  }

  alignCenter(): void {
    this.executeAlignmentCommand('justifyCenter', 'center');
  }

  alignRight(): void {
    this.executeAlignmentCommand('justifyRight', 'right');
  }

  alignJustify(): void {
    this.executeAlignmentCommand('justifyFull', 'justify');
  }

  /**
   * Execute alignment command with proper selection handling
   */
  private executeAlignmentCommand(
    command: string,
    alignment: 'left' | 'center' | 'right' | 'justify'
  ): void {
    const editorElement = this.selectionManager.getEditorElement();
    if (!editorElement) return;

    // Ensure editor has focus
    editorElement.focus();

    // Restore the captured selection
    if (this.capturedRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(this.capturedRange);
      }
    } else {
      // Fallback to saved selection from service
      this.selectionManager.restoreSelection();
    }

    // Small delay to ensure selection is applied before command
    setTimeout(() => {
      try {
        const result = document.execCommand(command, false, '');

        if (result) {
          this.currentAlignment = alignment;
          this.selectionManager.saveSelection();
          this.commandExecuted.emit();
        }
      } catch (error) {
        console.error('Alignment command failed:', error);
      }

      // Clear captured range after use
      this.capturedRange = null;
    }, 0);
  }

  /**
   * Update toolbar state based on current selection
   */
  updateState(): void {
    const editorElement = this.selectionManager.getEditorElement();
    if (!editorElement) {
      this.currentAlignment = '';
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.currentAlignment = '';
      return;
    }

    // Find the block element containing the selection
    let node: Node | null = selection.anchorNode;

    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    while (node && node !== editorElement) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();

        // Check block-level elements
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tagName)) {
          const textAlign = element.style.textAlign ||
            window.getComputedStyle(element).textAlign;

          switch (textAlign) {
            case 'left':
            case 'start':
              this.currentAlignment = 'left';
              return;
            case 'center':
              this.currentAlignment = 'center';
              return;
            case 'right':
            case 'end':
              this.currentAlignment = 'right';
              return;
            case 'justify':
              this.currentAlignment = 'justify';
              return;
            default:
              this.currentAlignment = '';
              return;
          }
        }
      }
      node = node.parentElement;
    }

    this.currentAlignment = '';
  }
}