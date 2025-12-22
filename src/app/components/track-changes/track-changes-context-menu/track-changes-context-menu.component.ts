import { Component, EventEmitter, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil } from 'rxjs';
import { TrackChangesStateService } from 'src/app/services/track-changes';

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
 * Track Changes Context Menu Component (Compact Version)
 * 
 * Displays a compact context menu when right-clicking on tracked changes.
 * Provides options to accept/reject current change or all changes.
 * 
 * Compatible with Angular Material 13/14 (non-MDC)
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
    // ViewEncapsulation.None is required to style the mat-menu panel
    encapsulation: ViewEncapsulation.None,
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

        <!-- The actual context menu with custom panel class -->
        <mat-menu #contextMenu="matMenu" 
                  class="tc-context-menu"
                  [overlapTrigger]="false"
                  backdropClass="tc-backdrop">
            
            <!-- Header showing change info -->
            <div class="tc-menu-header" *ngIf="contextData?.changeId" (click)="$event.stopPropagation()">
                <span class="tc-change-type" 
                      [class.insert]="contextData?.changeType === 'insert'" 
                      [class.delete]="contextData?.changeType === 'delete'">
                    {{ contextData?.changeType === 'insert' ? 'Insertion' : 'Deletion' }}
                </span>
                <span class="tc-change-user" *ngIf="contextData?.userName">
                    by {{ contextData?.userName }}
                </span>
            </div>

            <mat-divider *ngIf="contextData?.changeId"></mat-divider>

            <!-- Accept Current Change -->
            <button mat-menu-item 
                    class="tc-menu-item"
                    *ngIf="contextData?.changeId"
                    (click)="onAcceptCurrent()">
                <mat-icon class="tc-accept-icon">check_circle</mat-icon>
                <span>Accept</span>
            </button>

            <!-- Reject Current Change -->
            <button mat-menu-item 
                    class="tc-menu-item"
                    *ngIf="contextData?.changeId"
                    (click)="onRejectCurrent()">
                <mat-icon class="tc-reject-icon">cancel</mat-icon>
                <span>Reject</span>
            </button>

            <mat-divider *ngIf="contextData?.changeId && contextData?.hasChanges"></mat-divider>

            <!-- Accept All Changes -->
            <button mat-menu-item 
                    class="tc-menu-item"
                    *ngIf="contextData?.hasChanges"
                    (click)="onAcceptAll()">
                <mat-icon class="tc-accept-icon">done_all</mat-icon>
                <span>Accept All</span>
            </button>

            <!-- Reject All Changes -->
            <button mat-menu-item 
                    class="tc-menu-item"
                    *ngIf="contextData?.hasChanges"
                    (click)="onRejectAll()">
                <mat-icon class="tc-reject-icon">clear_all</mat-icon>
                <span>Reject All</span>
            </button>

            <!-- No changes message -->
            <div class="tc-no-changes" *ngIf="!contextData?.changeId && !contextData?.hasChanges" 
                 (click)="$event.stopPropagation()">
                <mat-icon>info_outline</mat-icon>
                <span>No tracked changes</span>
            </div>
        </mat-menu>
    `,
    styles: [`
        /* Trigger styling */
        .context-menu-trigger {
            width: 1px;
            height: 1px;
            visibility: hidden;
            pointer-events: none;
        }

        /* ========================================
           COMPACT MAT-MENU PANEL STYLES
           Angular Material 13/14 (Legacy/Non-MDC)
           ======================================== */
        
        /* Target the mat-menu panel */
        .mat-menu-panel {
            min-width: 140px !important;
            max-width: 200px !important;
            border-radius: 6px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        }

        /* Reduce padding on menu content */
        .mat-menu-content {
            padding: 4px 0 !important;
        }

        /* ========================================
           COMPACT MENU ITEM STYLES
           ======================================== */
        
        /* Make menu items smaller */
        .tc-menu-item.mat-menu-item {
            height: 32px !important;
            line-height: 32px !important;
            padding: 0 12px !important;
            font-size: 13px !important;
        }

        /* Smaller icons in menu items */
        .tc-menu-item.mat-menu-item .mat-icon {
            font-size: 18px !important;
            width: 18px !important;
            height: 18px !important;
            margin-right: 8px !important;
            vertical-align: middle;
        }

        /* ========================================
           HEADER STYLES
           ======================================== */
        
        .tc-menu-header {
            padding: 6px 12px;
            font-size: 11px;
            color: #666;
            display: flex;
            flex-direction: column;
            gap: 1px;
            cursor: default;
            background-color: #fafafa;
            border-bottom: 1px solid #eee;
        }

        .tc-change-type {
            font-weight: 600;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
        }

        .tc-change-type.insert {
            color: #2e7d32;
        }

        .tc-change-type.delete {
            color: #c62828;
        }

        .tc-change-user {
            font-size: 11px;
            color: #888;
        }

        /* ========================================
           ICON COLORS
           ======================================== */
        
        .tc-accept-icon {
            color: #4caf50 !important;
        }

        .tc-reject-icon {
            color: #f44336 !important;
        }

        /* ========================================
           NO CHANGES MESSAGE
           ======================================== */
        
        .tc-no-changes {
            padding: 10px 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            color: #888;
            font-size: 12px;
            cursor: default;
        }

        .tc-no-changes mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #aaa;
        }

        /* ========================================
           DIVIDER STYLING
           ======================================== */
        
        .mat-menu-content mat-divider,
        .mat-menu-content .mat-divider {
            margin: 4px 0 !important;
        }
    `]
})
export class TrackChangesContextMenuComponent {
    private destroy$ = new Subject<void>();
    @ViewChild('menuTrigger', { static: true }) menuTrigger!: MatMenuTrigger;

    @Output() acceptCurrent = new EventEmitter<string>();
    @Output() rejectCurrent = new EventEmitter<string>();
    @Output() acceptAll = new EventEmitter<void>();
    @Output() rejectAll = new EventEmitter<void>();

    menuPosition = { x: 0, y: 0 };
    contextData: TrackChangesContextMenuData | null = null;

    constructor(private stateService: TrackChangesStateService) { }

    ngAfterViewInit(): void {
        this.menuTrigger.menuClosed
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                // Directly focus editor - no event emission needed
                this.stateService.getEditorElement()?.focus();
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

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