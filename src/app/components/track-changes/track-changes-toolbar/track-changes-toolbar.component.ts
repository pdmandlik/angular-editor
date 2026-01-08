/**
 * Track Changes Toolbar Component
 * Path: src/app/components/track-changes/track-changes-toolbar/track-changes-toolbar.component.ts
 * 
 * Controls track changes: toggle tracking, visibility, accept/reject changes.
 * Uses split button pattern with expandable accept/reject actions.
 */

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { animate, style, transition, trigger, state } from '@angular/animations';
import { TrackChangesService } from 'src/app/services/track-changes';
import { TrackChangesState } from 'src/app/entities/editor-config';

@Component({
  selector: 'ed-track-changes-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatDividerModule],
  animations: [
    trigger('expandActions', [
      transition(':enter', [
        style({ width: 0, opacity: 0, transform: 'scaleX(0.8)' }),
        animate('200ms cubic-bezier(0, 0, 0.3, 1)',
          style({ width: '*', opacity: 1, transform: 'scaleX(1)' }))
      ]),
      transition(':leave', [
        animate('150ms cubic-bezier(0.4, 0, 1, 1)',
          style({ width: 0, opacity: 0, transform: 'scaleX(0.8)' }))
      ])
    ]),
    trigger('iconSpin', [
      transition('off => on', [
        animate('280ms cubic-bezier(0.4, 0.14, 0.3, 1)', style({ transform: 'rotate(360deg)' }))
      ])
    ]),
    trigger('badgeBounce', [
      transition(':enter', [
        style({ transform: 'scale(0)', opacity: 0 }),
        animate('250ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':increment', [
        animate('120ms ease-out', style({ transform: 'scale(1.15)' })),
        animate('180ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)' }))
      ])
    ])
  ],
  template: `
    <div class="track-changes-container" 
         [class.expanded]="showAcceptReject"
         (mouseenter)="onMouseEnter()"
         (mouseleave)="onMouseLeave()">
      
      <button
        class="toggle-btn"
        [matTooltip]="getToggleTrackingTooltip()"
        mat-icon-button
        [class.active]="state.isEnabled"
        (click)="onToggleTracking()"
        type="button">
        <mat-icon [class.enabled]="state.isEnabled" [@iconSpin]="state.isEnabled ? 'on' : 'off'">
          {{ state.isEnabled ? 'track_changes' : 'edit_off' }}
        </mat-icon>
      </button>

      <button
        [matTooltip]="getToggleShowTooltip()"
        mat-icon-button
        [class.active]="state.isVisible"
        [disabled]="!state.isEnabled"
        (click)="onToggleShow()"
        type="button">
        <mat-icon>{{ state.isVisible ? 'visibility' : 'visibility_off' }}</mat-icon>
      </button>

      <ng-container *ngIf="state.pendingCount > 0">
        <div class="divider-line"></div>
        
        <div class="split-action accept-group">
          <button mat-icon-button class="accept-btn" [matTooltip]="'Accept Change at Cursor'" (click)="onAcceptOne()" type="button">
            <mat-icon>check</mat-icon>
          </button>
          <button *ngIf="showAcceptReject" [@expandActions] mat-icon-button class="accept-btn"
                  [matTooltip]="'Accept All (' + state.pendingCount + ')'" (click)="onAcceptAll()" type="button">
            <mat-icon>done_all</mat-icon>
          </button>
        </div>

        <div class="split-action reject-group">
          <button mat-icon-button class="reject-btn" [matTooltip]="'Reject Change at Cursor'" (click)="onRejectOne()" type="button">
            <mat-icon>close</mat-icon>
          </button>
          <button *ngIf="showAcceptReject" [@expandActions] mat-icon-button class="reject-btn"
                  [matTooltip]="'Reject All (' + state.pendingCount + ')'" (click)="onRejectAll()" type="button">
            <mat-icon>clear_all</mat-icon>
          </button>
        </div>

        <div class="pending-badge" [@badgeBounce]="state.pendingCount">{{ state.pendingCount }}</div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display: flex; align-items: center; }

    .track-changes-container {
      display: flex;
      align-items: center;
      gap: var(--ed-group-gap, 2px);
      padding: var(--ed-group-padding, 4px);
      background: var(--ed-primary-surface, #ede7f6);
      border-radius: var(--ed-radius-pill, 24px);
      box-shadow: var(--ed-shadow-soft);
      transition: 
        box-shadow var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        padding var(--ed-duration-normal, 200ms) var(--ed-easing-standard);
    }

    .track-changes-container:hover,
    .track-changes-container.expanded {
      box-shadow: var(--ed-shadow-elevated);
    }

    button {
      border-radius: var(--ed-radius-button, 12px) !important;
      transition: 
        background-color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        color var(--ed-duration-normal, 200ms) var(--ed-easing-standard),
        transform var(--ed-duration-normal, 200ms) var(--ed-easing-spring);
    }

    button:hover:not(:disabled) { transform: scale(1.05); }
    button:active:not(:disabled) { transform: scale(0.95); transition: transform var(--ed-duration-fast, 120ms) var(--ed-easing-standard); }
    button.active { background-color: var(--ed-button-active-bg) !important; }
    button:disabled { opacity: 0.38; }

    .mat-icon.enabled { color: var(--ed-success, #4caf50) !important; }
    .divider-line { width: 1px; height: 24px; background: rgba(0, 0, 0, 0.12); margin: 0 4px; }
    .split-action { display: flex; align-items: center; gap: 1px; }

    .accept-btn:not(:disabled) { color: var(--ed-success, #4caf50); }
    .accept-btn:hover:not(:disabled) { background-color: rgba(76, 175, 80, 0.12) !important; }
    .reject-btn:not(:disabled) { color: var(--ed-error, #f44336); }
    .reject-btn:hover:not(:disabled) { background-color: rgba(244, 67, 54, 0.12) !important; }

    .pending-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      background: var(--ed-primary, #7c4dff);
      color: var(--ed-on-primary, #fff);
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 4px;
    }
  `]
})
export class TrackChangesToolbarComponent implements OnInit, OnDestroy {
  @Input() visible = true;

  @Output() toggleTracking = new EventEmitter<void>();
  @Output() toggleShow = new EventEmitter<boolean>();
  @Output() acceptAll = new EventEmitter<void>();
  @Output() rejectAll = new EventEmitter<void>();
  @Output() acceptOne = new EventEmitter<void>();
  @Output() rejectOne = new EventEmitter<void>();

  state: TrackChangesState = { isEnabled: false, isVisible: true, changes: [], pendingCount: 0 };
  showAcceptReject = false;
  private hoverTimeout: any;
  private subscription = new Subscription();

  constructor(private trackChangesService: TrackChangesService) { }

  ngOnInit(): void {
    this.subscription.add(
      this.trackChangesService.getState().subscribe(s => this.state = s)
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
  }

  onMouseEnter(): void {
    if (this.state.pendingCount > 0) {
      this.hoverTimeout = setTimeout(() => this.showAcceptReject = true, 150);
    }
  }

  onMouseLeave(): void {
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.showAcceptReject = false;
  }

  getToggleTrackingTooltip(): string {
    return this.state.isEnabled ? 'Disable Track Changes' : 'Enable Track Changes';
  }

  getToggleShowTooltip(): string {
    return this.state.isVisible ? 'Hide Changes' : 'Show Changes';
  }

  onToggleTracking(): void { this.toggleTracking.emit(); }
  onToggleShow(): void { this.toggleShow.emit(!this.state.isVisible); }
  onAcceptAll(): void { this.acceptAll.emit(); }
  onRejectAll(): void { this.rejectAll.emit(); }
  onAcceptOne(): void { this.acceptOne.emit(); }
  onRejectOne(): void { this.rejectOne.emit(); }
}