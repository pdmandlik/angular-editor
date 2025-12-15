import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ImageUploadDialogComponent } from '../../dialogs/image-upload-dialog/image-upload-dialog.component';
import { ImageUploadService } from 'src/app/services/image-upload.service';
import { CommandExecutorService } from 'src/app/services/command-executor.service';
import { SelectionManagerService } from 'src/app/services/selection-manager.service';
import { ContentSanitizerService } from 'src/app/services/content-sanitizer.service';

/**
 * Image Toolbar Component
 * Handles: Image upload and insertion
 */
@Component({
    selector: 'ed-image-toolbar',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatDialogModule],
    template: `
    <button
      matTooltip="Insert Image"
      mat-icon-button
      (click)="insertImage()"
      type="button">
      <mat-icon>image</mat-icon>
    </button>
  `,
    styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class ImageToolbarComponent {
    @Output() commandExecuted = new EventEmitter<void>();

    private readonly MAX_IMAGE_SIZE_MB = 5;
    private readonly MAX_IMAGE_DIMENSION = 10000;

    constructor(
        private dialog: MatDialog,
        private imageUploadService: ImageUploadService,
        private commandExecutor: CommandExecutorService,
        private selectionManager: SelectionManagerService,
        private sanitizer: ContentSanitizerService
    ) { }

    insertImage(): void {
        this.selectionManager.saveSelection();

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (event: any) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const validation = this.imageUploadService.validateImageFile(file, this.MAX_IMAGE_SIZE_MB);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }

            let previewUrl: string | null = null;

            try {
                const dimensions = await this.imageUploadService.getImageDimensions(file);

                if (dimensions.width > this.MAX_IMAGE_DIMENSION || dimensions.height > this.MAX_IMAGE_DIMENSION) {
                    alert(`Image dimensions too large. Maximum allowed: ${this.MAX_IMAGE_DIMENSION}px`);
                    return;
                }

                previewUrl = URL.createObjectURL(file);

                if (!file || !previewUrl || !dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
                    if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                    }
                    alert('Invalid image file');
                    return;
                }

                const dialogRef = this.dialog.open(ImageUploadDialogComponent, {
                    width: '700px',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    disableClose: true,
                    panelClass: 'image-upload-dialog-panel',
                    autoFocus: false,
                    data: {
                        file,
                        previewUrl,
                        dimensions
                    }
                });

                dialogRef.afterClosed().subscribe({
                    next: (result) => {
                        if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                            previewUrl = null;
                        }

                        if (result && result.url) {
                            this.insertImageWithProperties(result.url, result.config);
                        }
                    },
                    error: () => {
                        if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                            previewUrl = null;
                        }
                    }
                });

            } catch (error) {
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    previewUrl = null;
                }
                alert('Error processing image file');
            }
        };

        input.click();
    }

    private insertImageWithProperties(url: string, config: any): void {
        if (this.selectionManager.isSelectionValid()) {
            this.selectionManager.restoreSelection();
        }

        const sanitizedUrl = this.sanitizer.sanitizeImageUrl(url);
        if (!sanitizedUrl) {
            return;
        }

        const styles: string[] = [];

        if (config.width !== null && config.widthUnit !== 'auto') {
            styles.push(`width: ${config.width}${config.widthUnit}`);
        }
        if (config.height !== null && config.heightUnit !== 'auto') {
            styles.push(`height: ${config.height}${config.heightUnit}`);
        }

        if (config.alignment === 'left') {
            styles.push('float: left');
        } else if (config.alignment === 'right') {
            styles.push('float: right');
        } else if (config.alignment === 'center') {
            styles.push('display: block', 'margin-left: auto', 'margin-right: auto');
        }

        styles.push(`vertical-align: ${config.verticalAlign}`);

        if (config.hspace > 0) {
            styles.push(`margin-left: ${config.hspace}px`, `margin-right: ${config.hspace}px`);
        }
        if (config.vspace > 0) {
            styles.push(`margin-top: ${config.vspace}px`, `margin-bottom: ${config.vspace}px`);
        }

        if (config.border > 0 && config.borderStyle !== 'none') {
            styles.push(`border: ${config.border}px ${config.borderStyle} ${config.borderColor}`);
        }

        const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
        const altAttr = config.altText ? ` alt="${this.sanitizer.escapeHtml(config.altText)}"` : ' alt=""';

        const imageHTML = `<img src="${sanitizedUrl}"${altAttr}${styleAttr}>`;

        this.commandExecutor.insertHTML(imageHTML);
        this.commandExecuted.emit();
    }
}