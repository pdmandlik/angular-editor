import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ImageConfig, ImageUploadDialogData } from 'src/app/entities/editor-config';
import { ImageUploadService } from 'src/app/services/image-upload.service';
import { Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'ed-image-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './image-upload-dialog.component.html',
  styleUrls: ['./image-upload-dialog.component.scss']
})
export class ImageUploadDialogComponent implements OnInit, OnDestroy {
  imageConfig: ImageConfig;
  uploading = false;
  uploadProgress = 0;
  errorMessage = '';
  
  safePreviewUrl: SafeUrl | null = null;
  
  private readonly MAX_DIMENSION = 10000;
  private readonly MIN_DIMENSION = 1;

  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<ImageUploadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ImageUploadDialogData,
    private imageUploadService: ImageUploadService,
    private sanitizer: DomSanitizer
  ) {
    if (!data) {
      this.errorMessage = 'No data provided to dialog';
      throw new Error('Dialog data is required');
    }

    if (!data.file) {
      this.errorMessage = 'No file provided';
      throw new Error('File is required');
    }

    if (!data.previewUrl) {
      this.errorMessage = 'No preview URL provided';
      throw new Error('Preview URL is required');
    }

    if (!data.dimensions || data.dimensions.width <= 0 || data.dimensions.height <= 0) {
      this.errorMessage = 'Invalid image dimensions';
      throw new Error('Valid dimensions are required');
    }

    if (data.dimensions.width > this.MAX_DIMENSION || data.dimensions.height > this.MAX_DIMENSION) {
      this.errorMessage = `Image dimensions too large. Maximum: ${this.MAX_DIMENSION}px`;
      throw new Error('Image dimensions exceed maximum allowed');
    }

    this.safePreviewUrl = this.sanitizer.bypassSecurityTrustUrl(data.previewUrl);

    this.imageConfig = {
      file: data.file,
      previewUrl: data.previewUrl,
      altText: '',
      width: data.dimensions.width,
      height: data.dimensions.height,
      widthUnit: 'px',
      heightUnit: 'px',
      lockRatio: true,
      originalWidth: data.dimensions.width,
      originalHeight: data.dimensions.height,
      alignment: 'center',
      verticalAlign: 'middle',
      vspace: 0,
      hspace: 0,
      border: 0,
      borderColor: '#000000',
      borderStyle: 'none'
    };
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getFileSizeString(): string {
    const bytes = this.imageConfig.file.size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  toggleLockRatio(): void {
    this.imageConfig.lockRatio = !this.imageConfig.lockRatio;
  }

  onWidthChange(): void {
    if (this.imageConfig.width !== null) {
      if (this.imageConfig.width < this.MIN_DIMENSION) {
        this.imageConfig.width = this.MIN_DIMENSION;
      }
      if (this.imageConfig.width > this.MAX_DIMENSION) {
        this.imageConfig.width = this.MAX_DIMENSION;
      }
    }

    if (this.imageConfig.lockRatio && 
        this.imageConfig.width && 
        this.imageConfig.widthUnit === 'px' && 
        this.imageConfig.heightUnit === 'px' &&
        this.imageConfig.originalHeight > 0) {
      const aspectRatio = this.imageConfig.originalWidth / this.imageConfig.originalHeight;
      this.imageConfig.height = Math.round(this.imageConfig.width / aspectRatio);
      
      if (this.imageConfig.height < this.MIN_DIMENSION) {
        this.imageConfig.height = this.MIN_DIMENSION;
      }
      if (this.imageConfig.height > this.MAX_DIMENSION) {
        this.imageConfig.height = this.MAX_DIMENSION;
        this.imageConfig.width = Math.round(this.imageConfig.height * aspectRatio);
      }
    }
  }

  onHeightChange(): void {
    if (this.imageConfig.height !== null) {
      if (this.imageConfig.height < this.MIN_DIMENSION) {
        this.imageConfig.height = this.MIN_DIMENSION;
      }
      if (this.imageConfig.height > this.MAX_DIMENSION) {
        this.imageConfig.height = this.MAX_DIMENSION;
      }
    }

    if (this.imageConfig.lockRatio && 
        this.imageConfig.height && 
        this.imageConfig.widthUnit === 'px' && 
        this.imageConfig.heightUnit === 'px' &&
        this.imageConfig.originalWidth > 0) {
      const aspectRatio = this.imageConfig.originalWidth / this.imageConfig.originalHeight;
      this.imageConfig.width = Math.round(this.imageConfig.height * aspectRatio);
      
      if (this.imageConfig.width < this.MIN_DIMENSION) {
        this.imageConfig.width = this.MIN_DIMENSION;
      }
      if (this.imageConfig.width > this.MAX_DIMENSION) {
        this.imageConfig.width = this.MAX_DIMENSION;
        this.imageConfig.height = Math.round(this.imageConfig.width / aspectRatio);
      }
    }
  }

  onWidthUnitChange(): void {
    if (this.imageConfig.widthUnit === 'auto') {
      this.imageConfig.width = null;
    } else if (this.imageConfig.width === null) {
      this.imageConfig.width = this.imageConfig.widthUnit === 'px' 
        ? this.imageConfig.originalWidth 
        : 100;
    }
    
    if (this.imageConfig.widthUnit !== this.imageConfig.heightUnit) {
      this.imageConfig.lockRatio = false;
    }
  }

  onHeightUnitChange(): void {
    if (this.imageConfig.heightUnit === 'auto') {
      this.imageConfig.height = null;
    } else if (this.imageConfig.height === null) {
      this.imageConfig.height = this.imageConfig.heightUnit === 'px' 
        ? this.imageConfig.originalHeight 
        : 100;
    }
    
    if (this.imageConfig.widthUnit !== this.imageConfig.heightUnit) {
      this.imageConfig.lockRatio = false;
    }
  }

  resetDimensions(): void {
    this.imageConfig.width = this.imageConfig.originalWidth;
    this.imageConfig.height = this.imageConfig.originalHeight;
    this.imageConfig.widthUnit = 'px';
    this.imageConfig.heightUnit = 'px';
    this.imageConfig.lockRatio = true;
  }

  onUpload(): void {
    if (!this.imageConfig.file) {
      this.errorMessage = 'No file to upload';
      return;
    }

    if (this.imageConfig.widthUnit === 'px' && this.imageConfig.width) {
      if (this.imageConfig.width < this.MIN_DIMENSION) {
        this.errorMessage = `Width must be at least ${this.MIN_DIMENSION} pixel`;
        return;
      }
      if (this.imageConfig.width > this.MAX_DIMENSION) {
        this.errorMessage = `Width cannot exceed ${this.MAX_DIMENSION} pixels`;
        return;
      }
    }

    if (this.imageConfig.heightUnit === 'px' && this.imageConfig.height) {
      if (this.imageConfig.height < this.MIN_DIMENSION) {
        this.errorMessage = `Height must be at least ${this.MIN_DIMENSION} pixel`;
        return;
      }
      if (this.imageConfig.height > this.MAX_DIMENSION) {
        this.errorMessage = `Height cannot exceed ${this.MAX_DIMENSION} pixels`;
        return;
      }
    }

    this.uploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';

    this.imageUploadService.uploadImage(this.imageConfig.file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.progress !== undefined) {
            this.uploadProgress = result.progress;
          }

          if (result.url) {
            this.dialogRef.close({
              url: result.url,
              config: this.imageConfig
            });
          }
        },
        error: (error) => {
          console.error('Upload error:', error);
          this.uploading = false;
          this.uploadProgress = 0;
          this.errorMessage = error?.message || 'Failed to upload image. Please try again.';
        }
      });
  }

  onCancel(): void {
    if (this.uploading) {
      const confirm = window.confirm('Upload in progress. Are you sure you want to cancel?');
      if (!confirm) {
        return;
      }
    }
    
    this.dialogRef.close(null);
  }
}