import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { TrackChangesService } from 'src/app/services/track-changes.service';
import { TrackChangesState } from 'src/app/entities/editor-config';

@Component({
  selector: 'app-track-changes-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatDividerModule],
  templateUrl: './track-changes-toolbar.component.html',
  styleUrls: ['./track-changes-toolbar.component.scss']
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

  constructor(private trackChangesService: TrackChangesService) {}

  ngOnInit(): void {
    this.subscription = this.trackChangesService.getState().subscribe(state => {
      this.state = state;
      this.visible = state.isVisible;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  getToggleTrackingTooltip(): string {
    if (!this.state.isEnabled) {
      return 'Start Tracking Changes';
    }
    return this.state.pendingCount > 0 
      ? `Stop Tracking Changes (${this.state.pendingCount} pending)` 
      : 'Stop Tracking Changes';
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