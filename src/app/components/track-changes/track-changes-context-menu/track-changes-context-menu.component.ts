import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

/**
 * Context menu data passed when opening the menu
 */
export interface TrackChangesContextMenuData {
    changeId: string | null;
    changeType: 'insert' | 'delete' | null;
    userName: string | null;
    timestamp: Date | null;
    hasChanges: boolean;
}

/**
 * Track Changes Context Menu Component
 * 
 * Displays a context menu when right-clicking on tracked changes.
 * Provides options to accept/reject current change or all changes.
 */
@Component({
    selector: 'ed-track-changes-context-menu',
    standalone: true,
    imports: [
        CommonModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule
    ],
    template: `
        <!-- Hidden trigger for the menu - positioned dynamically -->
        <div 
            class="context-menu-trigger"
            [matMenuTriggerFor]="contextMenu"
            #menuTrigger="matMenuTrigger"
            [style.position]="'fixed'"
            [style.left.px]="menuPosition.x"
            [style.top.px]="menuPosition.y">
        </div>

        <!-- The actual context menu -->
        <mat-menu #contextMenu="matMenu" class="track-changes-context-menu">
            <!-- Header showing change info -->
            <div class="menu-header" *ngIf="contextData?.changeId" (click)="$event.stopPropagation()">
                <span class="change-type" [class.insert]="contextData?.changeType === 'insert'" 
                      [class.delete]="contextData?.changeType === 'delete'">
                    {{ contextData?.changeType === 'insert' ? 'Insertion' : 'Deletion' }}
                </span>
                <span class="change-user" *ngIf="contextData?.userName">
                    by {{ contextData?.userName }}
                </span>
            </div>

            <mat-divider *ngIf="contextData?.changeId"></mat-divider>

            <!-- Accept Current Change -->
            <button mat-menu-item 
                    *ngIf="contextData?.changeId"
                    (click)="onAcceptCurrent()">
                <mat-icon class="accept-icon">check_circle</mat-icon>
                <span>Accept This Change</span>
            </button>

            <!-- Reject Current Change -->
            <button mat-menu-item 
                    *ngIf="contextData?.changeId"
                    (click)="onRejectCurrent()">
                <mat-icon class="reject-icon">cancel</mat-icon>
                <span>Reject This Change</span>
            </button>

            <mat-divider *ngIf="contextData?.changeId && contextData?.hasChanges"></mat-divider>

            <!-- Accept All Changes -->
            <button mat-menu-item 
                    *ngIf="contextData?.hasChanges"
                    (click)="onAcceptAll()">
                <mat-icon class="accept-icon">done_all</mat-icon>
                <span>Accept All Changes</span>
            </button>

            <!-- Reject All Changes -->
            <button mat-menu-item 
                    *ngIf="contextData?.hasChanges"
                    (click)="onRejectAll()">
                <mat-icon class="reject-icon">clear_all</mat-icon>
                <span>Reject All Changes</span>
            </button>

            <!-- No changes message -->
            <div class="no-changes-message" *ngIf="!contextData?.changeId && !contextData?.hasChanges" 
                 (click)="$event.stopPropagation()">
                <mat-icon>info_outline</mat-icon>
                <span>No tracked changes</span>
            </div>
        </mat-menu>
    `,
    styles: [`
        .context-menu-trigger {
            width: 1px;
            height: 1px;
            visibility: hidden;
            pointer-events: none;
        }

        .menu-header {
            padding: 8px 16px;
            font-size: 12px;
            color: #666;
            display: flex;
            flex-direction: column;
            gap: 2px;
            cursor: default;
        }

        .change-type {
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }

        .change-type.insert {
            color: #2e7d32;
        }

        .change-type.delete {
            color: #c62828;
        }

        .change-user {
            font-size: 12px;
            color: #888;
        }

        .accept-icon {
            color: #4caf50 !important;
        }

        .reject-icon {
            color: #f44336 !important;
        }

        .no-changes-message {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #888;
            font-size: 14px;
            cursor: default;
        }

        .no-changes-message mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
        }
    `]
})
export class TrackChangesContextMenuComponent {
    @ViewChild('menuTrigger', { static: true }) menuTrigger!: MatMenuTrigger;

    @Output() acceptCurrent = new EventEmitter<string>();
    @Output() rejectCurrent = new EventEmitter<string>();
    @Output() acceptAll = new EventEmitter<void>();
    @Output() rejectAll = new EventEmitter<void>();

    menuPosition = { x: 0, y: 0 };
    contextData: TrackChangesContextMenuData | null = null;

    /**
     * Open the context menu at the specified position
     */
    openMenu(x: number, y: number, data: TrackChangesContextMenuData): void {
        this.menuPosition = { x, y };
        this.contextData = data;

        // Small delay to ensure position is applied before opening
        setTimeout(() => {
            if (this.menuTrigger) {
                this.menuTrigger.openMenu();
            }
        }, 0);
    }

    /**
     * Close the context menu
     */
    closeMenu(): void {
        if (this.menuTrigger) {
            this.menuTrigger.closeMenu();
        }
    }

    /**
     * Check if menu is open
     */
    isMenuOpen(): boolean {
        return this.menuTrigger?.menuOpen || false;
    }

    onAcceptCurrent(): void {
        if (this.contextData?.changeId) {
            this.acceptCurrent.emit(this.contextData.changeId);
        }
    }

    onRejectCurrent(): void {
        if (this.contextData?.changeId) {
            this.rejectCurrent.emit(this.contextData.changeId);
        }
    }

    onAcceptAll(): void {
        this.acceptAll.emit();
    }

    onRejectAll(): void {
        this.rejectAll.emit();
    }
}