/**
 * Toolbar Button Group Component
 * Path: src/app/components/shared/toolbar-button-group.component.ts
 * 
 * Container for grouping related toolbar buttons with consistent styling.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
    selector: 'ed-button-group',
    standalone: true,
    imports: [CommonModule],
    animations: [
        trigger('groupEnter', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(-6px) scale(0.97)' }),
                animate('300ms cubic-bezier(0, 0, 0.3, 1)',
                    style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
            ])
        ])
    ],
    template: `
    <div class="button-group-container"
         [class.highlighted]="highlighted"
         [class.compact]="compact"
         [@groupEnter]>
      <ng-content></ng-content>
    </div>
  `,
    styles: [`
    :host { display: inline-flex; }

    .button-group-container {
      display: flex;
      align-items: center;
      gap: var(--ed-group-gap, 2px);
      padding: var(--ed-group-padding, 4px);
      background: var(--ed-button-bg, #ffffff);
      border-radius: var(--ed-radius-pill, 24px);
      box-shadow: var(--ed-shadow-soft);
      transition: 
        box-shadow var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        background-color var(--ed-duration-normal, 200ms) var(--ed-easing-standard);
    }

    .button-group-container:hover {
      box-shadow: var(--ed-shadow-elevated);
    }

    .button-group-container.highlighted {
      background: var(--ed-primary-surface, #ede7f6);
    }

    .button-group-container.compact {
      padding: 2px;
      gap: 1px;
    }

    ::ng-deep .button-group-container {
      button, .mat-icon-button {
        border-radius: var(--ed-radius-button, 12px) !important;
        width: var(--ed-button-size, 36px) !important;
        height: var(--ed-button-size, 36px) !important;
        transition: 
          background-color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
          color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
          transform var(--ed-duration-normal, 200ms) var(--ed-easing-spring);
      }

      button:hover:not(:disabled), .mat-icon-button:hover:not(:disabled) {
        background-color: var(--ed-button-hover) !important;
        color: var(--ed-primary) !important;
        transform: scale(1.05);
      }

      button:active:not(:disabled), .mat-icon-button:active:not(:disabled) {
        transform: scale(0.95);
      }

      button.active, .mat-icon-button.active {
        background-color: var(--ed-button-active-bg) !important;
        color: var(--ed-primary) !important;
      }

      button:disabled, .mat-icon-button:disabled {
        opacity: 0.38;
        transform: none !important;
      }

      .mat-icon {
        font-size: var(--ed-icon-size, 20px) !important;
        width: var(--ed-icon-size, 20px) !important;
        height: var(--ed-icon-size, 20px) !important;
        line-height: var(--ed-icon-size, 20px) !important;
      }
    }
  `]
})
export class ToolbarButtonGroupComponent {
    @Input() highlighted = false;
    @Input() compact = false;
}