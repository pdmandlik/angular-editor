import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { TrackChangesService } from 'src/app/services/track-changes';
import { TrackChangesState } from 'src/app/entities/editor-config';

@Component({
  selector: 'ed-track-changes-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule
  ],
  template: `
    <!-- Track Changes Toolbar -->
    <div class="track-changes-buttons">
      <!-- Separator -->
      <mat-divider vertical style="height: 40px;"></mat-divider>

      <!-- Track Changes Toggle -->
      <button
        [matTooltip]="getToggleTrackingTooltip()"
        mat-icon-button
        [class.active]="state.isEnabled"
        (click)="onToggleTracking()"
        type="button">
        <mat-icon [style.color]="state.isEnabled ? '#4caf50' : ''">
          {{ state.isEnabled ? 'track_changes' : 'edit_off' }}
        </mat-icon>
      </button>

      <!-- Show/Hide Toggle (only enabled when tracking is on) -->
      <button
        [matTooltip]="getToggleShowTooltip()"
        mat-icon-button
        [class.active]="state.isVisible"
        [disabled]="!state.isEnabled"
        (click)="onToggleShow()"
        type="button">
        <mat-icon>{{ state.isVisible ? 'visibility' : 'visibility_off' }}</mat-icon>
      </button>

      <mat-divider vertical style="height: 40px;" *ngIf="state.pendingCount > 0"></mat-divider>

      <!-- Accept All -->
      <button
        [matTooltip]="getAcceptAllTooltip()"
        mat-icon-button
        [disabled]="state.pendingCount === 0"
        (click)="onAcceptAll()"
        type="button">
        <mat-icon [style.color]="state.pendingCount > 0 ? '#4caf50' : ''">done_all</mat-icon>
      </button>

      <!-- Reject All -->
      <button
        [matTooltip]="getRejectAllTooltip()"
        mat-icon-button
        [disabled]="state.pendingCount === 0"
        (click)="onRejectAll()"
        type="button">
        <mat-icon [style.color]="state.pendingCount > 0 ? '#f44336' : ''">clear_all</mat-icon>
      </button>

      <!-- Accept One (at cursor/selection) -->
      <button
        [matTooltip]="getAcceptOneTooltip()"
        mat-icon-button
        [disabled]="state.pendingCount === 0"
        (click)="onAcceptOne()"
        type="button">
        <mat-icon [style.color]="state.pendingCount > 0 ? '#4caf50' : ''">check_circle_outline</mat-icon>
      </button>

      <!-- Reject One (at cursor/selection) -->
      <button
        [matTooltip]="getRejectOneTooltip()"
        mat-icon-button
        [disabled]="state.pendingCount === 0"
        (click)="onRejectOne()"
        type="button">
        <mat-icon [style.color]="state.pendingCount > 0 ? '#f44336' : ''">highlight_off</mat-icon>
      </button>

      <!-- Pending Count Badge -->
      <div class="pending-badge" *ngIf="state.pendingCount > 0">
        <span class="badge-text">{{ state.pendingCount }}</span>
      </div>
    </div>
  `,
  styles: [`
    .track-changes-buttons {
      display: flex;
      align-items: center;
      gap: 4px;
      position: relative;
    }

    .pending-badge {
      background-color: #f44336;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 4px;
      min-width: 20px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      animation: pulse 2s infinite;
    }

    .badge-text {
      display: inline-block;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }

    button.active {
      background-color: rgba(76, 175, 80, 0.1);
    }

    button:disabled {
      opacity: 0.4;
    }

    button:not(:disabled):hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    mat-icon {
      transition: color 0.2s ease;
    }
  `]
})
export class TrackChangesToolbarComponent implements OnInit, OnDestroy {
  @Input() visible = true;
  @Output() toggleShow = new EventEmitter<boolean>();
  @Output() toggleTracking = new EventEmitter<void>();
  @Output() acceptAll = new EventEmitter<void>();
  @Output() rejectAll = new EventEmitter<void>();
  @Output() acceptOne = new EventEmitter<void>();
  @Output() rejectOne = new EventEmitter<void>();

  state: TrackChangesState = {
    isEnabled: false,
    isVisible: true,
    changes: [],
    pendingCount: 0
  };

  private subscription: Subscription = new Subscription();

  constructor(private trackChangesService: TrackChangesService) { }

  ngOnInit(): void {
    this.subscription = this.trackChangesService.getState().subscribe(state => {
      this.state = state;
      this.visible = state.isVisible;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Updated tooltip matching CKEditor Lite plugin behavior.
   * Informs user they must resolve pending changes before disabling.
   */
  getToggleTrackingTooltip(): string {
    if (!this.state.isEnabled) {
      return 'Start Tracking Changes';
    }

    // When enabled with pending changes, inform user they must resolve first
    if (this.state.pendingCount > 0) {
      const plural = this.state.pendingCount > 1 ? 's' : '';
      return `Stop Tracking (Resolve ${this.state.pendingCount} pending change${plural} first)`;
    }

    return 'Stop Tracking Changes';
  }

  getToggleShowTooltip(): string {
    return this.state.isVisible
      ? `Hide Tracked Changes (${this.state.pendingCount} pending)`
      : `Show Tracked Changes (${this.state.pendingCount} pending)`;
  }

  getAcceptAllTooltip(): string {
    return this.state.pendingCount > 0
      ? `Accept All Changes (${this.state.pendingCount})`
      : 'Accept All Changes (No pending changes)';
  }

  getRejectAllTooltip(): string {
    return this.state.pendingCount > 0
      ? `Reject All Changes (${this.state.pendingCount})`
      : 'Reject All Changes (No pending changes)';
  }

  getAcceptOneTooltip(): string {
    return this.state.pendingCount > 0
      ? 'Accept Selected Change'
      : 'Accept Selected Change (No pending changes)';
  }

  getRejectOneTooltip(): string {
    return this.state.pendingCount > 0
      ? 'Reject Selected Change'
      : 'Reject Selected Change (No pending changes)';
  }

  onToggleTracking(): void {
    this.toggleTracking.emit();
  }

  onToggleShow(): void {
    const newVisibility = !this.state.isVisible;
    this.toggleShow.emit(newVisibility);
  }

  onAcceptAll(): void {
    this.acceptAll.emit();
  }

  onRejectAll(): void {
    this.rejectAll.emit();
  }

  onAcceptOne(): void {
    this.acceptOne.emit();
  }

  onRejectOne(): void {
    this.rejectOne.emit();
  }
}