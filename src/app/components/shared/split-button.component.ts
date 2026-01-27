/**
 * Split Button Component
 * Path: src/app/components/shared/split-button.component.ts
 * 
 * Reusable split button with expandable secondary actions.
 * Pairs primary action with related actions in a connected menu.
 */

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { animate, state, style, transition, trigger } from '@angular/animations';

export interface SplitButtonAction {
    id: string;
    icon: string;
    label: string;
    tooltip?: string;
    disabled?: boolean;
    color?: 'default' | 'success' | 'error' | 'warning';
}

@Component({
    selector: 'ed-split-button',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
    animations: [
        trigger('expandCollapse', [
            state('collapsed', style({ width: '0', opacity: 0, transform: 'scaleX(0.8)' })),
            state('expanded', style({ width: '*', opacity: 1, transform: 'scaleX(1)' })),
            transition('collapsed => expanded', [animate('200ms cubic-bezier(0, 0, 0.3, 1)')]),
            transition('expanded => collapsed', [animate('160ms cubic-bezier(0.4, 0, 1, 1)')])
        ]),
        trigger('rotateIcon', [
            state('closed', style({ transform: 'rotate(0deg)' })),
            state('open', style({ transform: 'rotate(180deg)' })),
            transition('closed <=> open', [animate('180ms cubic-bezier(0.4, 0.14, 0.3, 1)')])
        ]),
        trigger('buttonPulse', [
            transition(':enter', [
                style({ transform: 'scale(0.85)', opacity: 0 }),
                animate('180ms cubic-bezier(0, 0, 0.3, 1)', style({ transform: 'scale(1)', opacity: 1 }))
            ])
        ])
    ],
    template: `
    <div class="split-button-container" 
         [class.expanded]="isExpanded"
         (mouseenter)="onMouseEnter()"
         (mouseleave)="onMouseLeave()">
      
      <button
        class="primary-action"
        mat-icon-button
        [matTooltip]="primaryTooltip"
        [disabled]="primaryDisabled"
        [class.active]="primaryActive"
        (mousedown)="onMouseDown($event)"
        (click)="onPrimaryClick()"
        type="button">
        <mat-icon>{{ primaryIcon }}</mat-icon>
      </button>

      <div class="secondary-actions" [@expandCollapse]="isExpanded ? 'expanded' : 'collapsed'">
        <button
          *ngFor="let action of actions"
          mat-icon-button
          class="secondary-action"
          [class.active]="activeActionId === action.id"
          [class.success]="action.color === 'success'"
          [class.error]="action.color === 'error'"
          [class.warning]="action.color === 'warning'"
          [matTooltip]="action.tooltip || action.label"
          [disabled]="action.disabled"
          (mousedown)="onMouseDown($event)"
          (click)="onActionClick(action)"
          [@buttonPulse]
          type="button">
          <mat-icon>{{ action.icon }}</mat-icon>
        </button>
      </div>

      <button
        *ngIf="menuActions.length > 0"
        mat-icon-button
        class="menu-trigger"
        [matMenuTriggerFor]="actionMenu"
        (menuOpened)="menuOpen = true"
        (menuClosed)="menuOpen = false"
        type="button">
        <mat-icon [@rotateIcon]="menuOpen ? 'open' : 'closed'">expand_more</mat-icon>
      </button>

      <mat-menu #actionMenu="matMenu" class="split-button-menu">
        <button 
          mat-menu-item 
          *ngFor="let action of menuActions"
          [disabled]="action.disabled"
          (click)="onActionClick(action)">
          <mat-icon [class.success]="action.color === 'success'" [class.error]="action.color === 'error'">
            {{ action.icon }}
          </mat-icon>
          <span>{{ action.label }}</span>
        </button>
      </mat-menu>
    </div>
  `,
    styles: [`
    .split-button-container {
      display: flex;
      align-items: center;
      background: var(--ed-button-bg, #fff);
      border-radius: var(--ed-radius-pill, 24px);
      box-shadow: var(--ed-shadow-soft);
      padding: var(--ed-group-padding, 4px);
      gap: var(--ed-group-gap, 2px);
      overflow: hidden;
      transition: 
        box-shadow var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        transform var(--ed-duration-normal, 200ms) var(--ed-easing-spring);
    }

    .split-button-container:hover,
    .split-button-container.expanded {
      box-shadow: var(--ed-shadow-elevated);
    }

    button {
      border-radius: var(--ed-radius-button, 12px) !important;
      width: var(--ed-button-size, 36px) !important;
      height: var(--ed-button-size, 36px) !important;
      transition: 
        background-color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        transform var(--ed-duration-normal, 200ms) var(--ed-easing-spring);
    }

    button:hover:not(:disabled) {
      background-color: var(--ed-button-hover);
      color: var(--ed-primary);
      transform: scale(1.05);
    }

    button:active:not(:disabled) {
      transform: scale(0.95);
      transition: transform var(--ed-duration-fast, 120ms) var(--ed-easing-standard);
    }

    button.active {
      background-color: var(--ed-button-active-bg) !important;
      color: var(--ed-primary) !important;
    }

    button:disabled { opacity: 0.38; }

    .mat-icon {
      font-size: var(--ed-icon-size, 20px) !important;
      width: var(--ed-icon-size, 20px) !important;
      height: var(--ed-icon-size, 20px) !important;
      transition: color var(--ed-duration-normal, 200ms) var(--ed-easing-standard);
    }

    .secondary-actions {
      display: flex;
      align-items: center;
      gap: var(--ed-group-gap, 2px);
      transform-origin: left center;
    }

    .secondary-action.success:not(:disabled) .mat-icon, .mat-icon.success { color: var(--ed-success, #4caf50); }
    .secondary-action.error:not(:disabled) .mat-icon, .mat-icon.error { color: var(--ed-error, #f44336); }
    .secondary-action.warning:not(:disabled) .mat-icon { color: var(--ed-warning, #ff9800); }
    .secondary-action.success:hover:not(:disabled) { background-color: rgba(76, 175, 80, 0.12) !important; }
    .secondary-action.error:hover:not(:disabled) { background-color: rgba(244, 67, 54, 0.12) !important; }

    .menu-trigger { margin-left: 2px; width: 28px !important; min-width: 28px !important; }
    .menu-trigger .mat-icon { font-size: 18px !important; width: 18px !important; height: 18px !important; }
  `]
})
export class SplitButtonComponent {
    @Input() primaryIcon = 'add';
    @Input() primaryTooltip = '';
    @Input() primaryDisabled = false;
    @Input() primaryActive = false;
    @Input() actions: SplitButtonAction[] = [];
    @Input() menuActions: SplitButtonAction[] = [];
    @Input() activeActionId: string | null = null;
    @Input() expandOnHover = true;
    @Input() startExpanded = false;

    @Output() primaryClick = new EventEmitter<void>();
    @Output() actionClick = new EventEmitter<SplitButtonAction>();

    isExpanded = false;
    menuOpen = false;
    private hoverTimeout: any;

    ngOnInit(): void {
        this.isExpanded = this.startExpanded;
    }

    onMouseEnter(): void {
        if (this.expandOnHover && this.actions.length > 0) {
            this.hoverTimeout = setTimeout(() => this.isExpanded = true, 100);
        }
    }

    onMouseLeave(): void {
        if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
        if (this.expandOnHover && !this.menuOpen) this.isExpanded = false;
    }

    onMouseDown(event: MouseEvent): void {
        event.preventDefault();
    }

    onPrimaryClick(): void {
        this.primaryClick.emit();
    }

    onActionClick(action: SplitButtonAction): void {
        this.actionClick.emit(action);
    }
}