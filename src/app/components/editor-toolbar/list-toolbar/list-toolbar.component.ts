import { Component, Output, EventEmitter, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';

/**
 * List Toolbar Component - Simple Fix Version
 * Handles: Bulleted List, Numbered List
 * 
 * This version keeps using document.execCommand but fixes the selection loss issue
 * by properly handling mousedown events and preventing focus loss.
 */
@Component({
  selector: 'ed-list-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      matTooltip="Bullet List"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="insertUnorderedList()"
      [class.active]="isBulletListActive"
      type="button">
      <mat-icon>format_list_bulleted</mat-icon>
    </button>
    <button
      matTooltip="Numbered List"
      mat-icon-button
      (mousedown)="onMouseDown($event)"
      (click)="insertOrderedList()"
      [class.active]="isNumberedListActive"
      type="button">
      <mat-icon>format_list_numbered</mat-icon>
    </button>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    button.active {
      background-color: rgba(0, 0, 0, 0.1);
    }
  `]
})
export class ListToolbarComponent {
  @Output() commandExecuted = new EventEmitter<void>();

  isBulletListActive = false;
  isNumberedListActive = false;

  // Store the range captured on mousedown
  private capturedRange: Range | null = null;

  constructor(private selectionManager: SelectionManagerService) { }

  /**
   * CRITICAL FIX: Capture selection on mousedown BEFORE focus changes
   * 
   * The issue: When you click a toolbar button:
   * 1. mousedown fires - focus starts moving to button
   * 2. blur fires on editor - selection may be lost/modified
   * 3. click fires - by this time selection is wrong
   * 
   * The fix: 
   * 1. Prevent default on mousedown to stop focus change
   * 2. Capture the current selection while it's still valid
   * 3. Use the captured selection for the command
   */
  onMouseDown(event: MouseEvent): void {
    // CRITICAL: Prevent default to stop focus from moving away from editor
    event.preventDefault();

    // Capture the current selection immediately
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

  insertUnorderedList(): void {
    this.executeListCommand('insertUnorderedList');
  }

  insertOrderedList(): void {
    this.executeListCommand('insertOrderedList');
  }

  /**
   * Execute list command with proper selection handling
   */
  private executeListCommand(command: 'insertUnorderedList' | 'insertOrderedList'): void {
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

    // Small delay to ensure selection is applied
    setTimeout(() => {
      try {
        // Execute the command
        const result = document.execCommand(command, false, '');

        if (result) {
          // Save the new selection state
          this.selectionManager.saveSelection();
          this.updateState();
          this.commandExecuted.emit();
        }
      } catch (error) {
        console.error('List command failed:', error);
      }

      // Clear captured range
      this.capturedRange = null;
    }, 0);
  }

  /**
   * Update toolbar button active states based on current cursor position
   */
  updateState(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.isBulletListActive = false;
      this.isNumberedListActive = false;
      return;
    }

    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;

    // Reset states
    this.isBulletListActive = false;
    this.isNumberedListActive = false;

    // Walk up the DOM tree to find list elements
    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'UL') {
          this.isBulletListActive = true;
          break;
        }
        if (element.tagName === 'OL') {
          this.isNumberedListActive = true;
          break;
        }
      }
      node = node.parentNode;
    }
  }
}