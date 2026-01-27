/**
 * Theme Picker Component
 * Path: src/app/components/theme-picker/theme-picker.component.ts
 * 
 * Provides UI for selecting preset themes and customizing colors.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { EditorThemeService } from 'src/app/services/editor-theme.service';
import { EditorTheme } from 'src/app/entities/editor-theme.config';

@Component({
    selector: 'ed-theme-picker',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatMenuModule,
        MatTabsModule,
        MatDividerModule
    ],
    animations: [
        trigger('themeCards', [
            transition(':enter', [
                query('.theme-card', [
                    style({ opacity: 0, transform: 'scale(0.92) translateY(8px)' }),
                    stagger('40ms', [
                        animate('220ms cubic-bezier(0, 0, 0.3, 1)',
                            style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
                    ])
                ], { optional: true })
            ])
        ]),
        trigger('colorSwatch', [
            transition(':enter', [
                style({ transform: 'scale(0)' }),
                animate('180ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)' }))
            ])
        ])
    ],
    template: `
    <div class="theme-picker-container">
      <button
        mat-icon-button
        class="theme-trigger"
        [matMenuTriggerFor]="themeMenu"
        matTooltip="Customize Theme"
        type="button">
        <mat-icon>palette</mat-icon>
      </button>

      <mat-menu #themeMenu="matMenu" class="theme-menu-panel" xPosition="before">
        <div class="theme-menu-content" (click)="$event.stopPropagation()">
          <mat-tab-group animationDuration="200ms">
            
            <mat-tab label="Themes">
              <div class="themes-grid" [@themeCards]>
                <div 
                  *ngFor="let theme of themes"
                  class="theme-card"
                  [class.selected]="currentTheme?.name === theme.name"
                  (click)="selectTheme(theme)">
                  <div class="theme-preview">
                    <div class="preview-toolbar" [style.background]="theme.colors.surface">
                      <div class="preview-group" [style.background]="theme.colors.buttonBg"
                           [style.borderRadius]="theme.shape.borderRadiusPill">
                        <span class="preview-btn" [style.background]="theme.colors.buttonActiveBg"></span>
                        <span class="preview-btn"></span>
                        <span class="preview-btn"></span>
                      </div>
                      <div class="preview-group" [style.background]="theme.colors.primarySurface"
                           [style.borderRadius]="theme.shape.borderRadiusPill">
                        <span class="preview-btn" [style.background]="theme.colors.primary"></span>
                        <span class="preview-btn"></span>
                      </div>
                    </div>
                    <div class="preview-content">
                      <div class="preview-line"></div>
                      <div class="preview-line short"></div>
                    </div>
                  </div>
                  <div class="theme-info">
                    <span class="theme-name">{{ theme.displayName }}</span>
                    <span class="theme-indicator" [style.background]="theme.colors.primary"></span>
                  </div>
                  <mat-icon class="check-icon" *ngIf="currentTheme?.name === theme.name">check_circle</mat-icon>
                </div>
              </div>
            </mat-tab>

            <mat-tab label="Customize">
              <div class="custom-colors-section">
                <h4>Primary Color</h4>
                <div class="color-picker-row">
                  <input 
                    type="color" 
                    class="color-input"
                    [ngModel]="customPrimaryColor"
                    (ngModelChange)="onPrimaryColorChange($event)">
                  <input 
                    type="text" 
                    class="hex-input"
                    [ngModel]="customPrimaryColor"
                    (ngModelChange)="onPrimaryColorChange($event)"
                    placeholder="#7c4dff">
                </div>

                <mat-divider></mat-divider>

                <h4>Quick Colors</h4>
                <div class="quick-colors">
                  <button
                    *ngFor="let color of quickColors"
                    class="quick-color-btn"
                    [style.background]="color"
                    [class.selected]="customPrimaryColor === color"
                    [@colorSwatch]
                    (click)="onPrimaryColorChange(color)"
                    type="button">
                  </button>
                </div>

                <mat-divider></mat-divider>

                <h4>Shape Style</h4>
                <div class="shape-options">
                  <button 
                    class="shape-btn"
                    [class.selected]="shapeStyle === 'rounded'"
                    (click)="setShapeStyle('rounded')"
                    type="button">
                    <div class="shape-preview rounded"></div>
                    <span>Rounded</span>
                  </button>
                  <button 
                    class="shape-btn"
                    [class.selected]="shapeStyle === 'pill'"
                    (click)="setShapeStyle('pill')"
                    type="button">
                    <div class="shape-preview pill"></div>
                    <span>Pill</span>
                  </button>
                  <button 
                    class="shape-btn"
                    [class.selected]="shapeStyle === 'soft'"
                    (click)="setShapeStyle('soft')"
                    type="button">
                    <div class="shape-preview soft"></div>
                    <span>Soft</span>
                  </button>
                </div>
              </div>
            </mat-tab>

          </mat-tab-group>
        </div>
      </mat-menu>
    </div>
  `,
    styles: [`
    .theme-picker-container { display: inline-flex; }

    .theme-trigger {
      border-radius: var(--ed-radius-button, 12px) !important;
      transition: 
        background-color 200ms cubic-bezier(0.2, 0, 0.38, 0.9),
        color 200ms cubic-bezier(0.2, 0, 0.38, 0.9),
        transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .theme-trigger:hover {
      background-color: var(--ed-button-hover);
      color: var(--ed-primary);
      transform: scale(1.05);
    }

    ::ng-deep .theme-menu-panel {
      max-width: 400px !important;
      border-radius: var(--ed-radius-menu, 16px) !important;
      overflow: hidden;
    }

    .theme-menu-content {
      padding: 8px;
      min-width: 340px;
    }

    ::ng-deep .theme-menu-content .mat-tab-body-wrapper { padding-top: 12px; }

    .themes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 4px;
    }

    .theme-card {
      position: relative;
      border-radius: 12px;
      border: 2px solid transparent;
      padding: 8px;
      cursor: pointer;
      background: #fafafa;
      transition: 
        transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 200ms cubic-bezier(0.2, 0, 0.38, 0.9),
        border-color 200ms cubic-bezier(0.2, 0, 0.38, 0.9),
        background-color 200ms cubic-bezier(0.2, 0, 0.38, 0.9);
    }

    .theme-card:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .theme-card.selected {
      border-color: var(--ed-primary);
      background: var(--ed-primary-surface);
    }

    .theme-preview {
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
      border: 1px solid #e0e0e0;
    }

    .preview-toolbar {
      display: flex;
      gap: 6px;
      padding: 6px 8px;
      border-bottom: 1px solid #e0e0e0;
    }

    .preview-group {
      display: flex;
      gap: 3px;
      padding: 3px;
    }

    .preview-btn {
      width: 10px;
      height: 10px;
      border-radius: 4px;
      background: #e0e0e0;
    }

    .preview-content { padding: 10px; }

    .preview-line {
      height: 6px;
      background: #e8e8e8;
      border-radius: 3px;
      margin-bottom: 6px;
    }

    .preview-line.short { width: 60%; margin-bottom: 0; }

    .theme-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      padding: 0 4px;
    }

    .theme-name { font-size: 12px; font-weight: 500; color: #333; }
    .theme-indicator { width: 12px; height: 12px; border-radius: 50%; }

    .check-icon {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 18px;
      color: var(--ed-primary);
    }

    .custom-colors-section { padding: 8px 4px; }
    .custom-colors-section h4 { font-size: 13px; font-weight: 500; color: #555; margin: 0 0 12px 0; }

    .color-picker-row {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }

    .color-input {
      width: 48px;
      height: 48px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      padding: 0;
      overflow: hidden;
    }

    .color-input::-webkit-color-swatch-wrapper { padding: 0; }
    .color-input::-webkit-color-swatch { border: 2px solid #e0e0e0; border-radius: 10px; }

    .hex-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      font-family: monospace;
      font-size: 14px;
      outline: none;
      transition: border-color 150ms ease;
    }

    .hex-input:focus { border-color: var(--ed-primary); }

    mat-divider { margin: 16px 0 !important; }

    .quick-colors { display: flex; flex-wrap: wrap; gap: 8px; }

    .quick-color-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 2px solid transparent;
      cursor: pointer;
      transition: 
        transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
        border-color 200ms cubic-bezier(0.2, 0, 0.38, 0.9),
        box-shadow 200ms cubic-bezier(0.2, 0, 0.38, 0.9);
    }

    .quick-color-btn:hover { transform: scale(1.12); }
    .quick-color-btn.selected { border-color: #333; box-shadow: 0 0 0 2px #fff, 0 0 0 4px currentColor; }

    .shape-options { display: flex; gap: 12px; }

    .shape-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .shape-btn:hover { border-color: #bbb; }
    .shape-btn.selected { border-color: var(--ed-primary); background: var(--ed-primary-surface); }

    .shape-preview { width: 40px; height: 20px; background: var(--ed-primary, #7c4dff); }
    .shape-preview.rounded { border-radius: 6px; }
    .shape-preview.pill { border-radius: 10px; }
    .shape-preview.soft { border-radius: 4px; }
    .shape-btn span { font-size: 11px; color: #666; }
  `]
})
export class ThemePickerComponent implements OnInit, OnDestroy {
    themes: EditorTheme[] = [];
    currentTheme: EditorTheme | null = null;
    customPrimaryColor = '#7c4dff';
    shapeStyle: 'rounded' | 'pill' | 'soft' = 'pill';

    quickColors = [
        '#7c4dff', '#0288d1', '#2e7d32', '#f4511e',
        '#e91e63', '#9c27b0', '#00bcd4', '#ff9800',
        '#795548', '#607d8b', '#3f51b5', '#009688'
    ];

    private subscription = new Subscription();

    constructor(private themeService: EditorThemeService) { }

    ngOnInit(): void {
        this.themes = this.themeService.getPresetThemes();
        this.subscription.add(
            this.themeService.getTheme().subscribe(theme => {
                this.currentTheme = theme;
                this.customPrimaryColor = theme.colors.primary;
                this.detectShapeStyle(theme);
            })
        );
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    selectTheme(theme: EditorTheme): void {
        this.themeService.setTheme(theme.name);
    }

    onPrimaryColorChange(color: string): void {
        if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
            this.customPrimaryColor = color;
            this.themeService.setPrimaryColor(color);
        }
    }

    setShapeStyle(style: 'rounded' | 'pill' | 'soft'): void {
        this.shapeStyle = style;
        const shapeConfig = this.getShapeConfig(style);
        if (this.currentTheme) {
            this.themeService.applyTheme({
                ...this.currentTheme,
                name: 'custom',
                displayName: 'Custom',
                shape: shapeConfig
            });
        }
    }

    private getShapeConfig(style: 'rounded' | 'pill' | 'soft') {
        const configs = {
            rounded: { borderRadiusPill: '16px', borderRadiusButton: '8px', borderRadiusContainer: '12px', borderRadiusMenu: '12px' },
            pill: { borderRadiusPill: '24px', borderRadiusButton: '12px', borderRadiusContainer: '16px', borderRadiusMenu: '16px' },
            soft: { borderRadiusPill: '8px', borderRadiusButton: '4px', borderRadiusContainer: '8px', borderRadiusMenu: '8px' }
        };
        return configs[style];
    }

    private detectShapeStyle(theme: EditorTheme): void {
        const radius = parseInt(theme.shape.borderRadiusPill);
        this.shapeStyle = radius >= 20 ? 'pill' : radius >= 12 ? 'rounded' : 'soft';
    }
}