import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, throwError, timeout, TimeoutError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ImageUploadResponse, ImageUploadError } from '../entities/editor-config';

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private readonly uploadEndpoint = 'https://localhost:44349/api/upload/image';
  private readonly UPLOAD_TIMEOUT_MS = 120000;
  private readonly MAX_IMAGE_DIMENSION = 10000;
  private readonly MIN_IMAGE_SIZE = 100;
  private readonly DIMENSION_CHECK_TIMEOUT = 30000;
  
  private readonly SUSPICIOUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.html', '.htm'];
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

  constructor(private http: HttpClient) {}

  uploadImage(file: File): Observable<{ progress: number; url?: string; response?: ImageUploadResponse }> {
    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      return throwError(() => ({
        message: validation.error || 'Invalid file',
        code: 'VALIDATION_ERROR'
      } as ImageUploadError));
    }

    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<ImageUploadResponse>(this.uploadEndpoint, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      timeout(this.UPLOAD_TIMEOUT_MS),
      map((event: HttpEvent<any>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            return { progress };

          case HttpEventType.Response:
            if (!event.body?.url) {
              throw new Error('Invalid response from server');
            }
            return {
              progress: 100,
              url: event.body.url,
              response: event.body
            };

          default:
            return { progress: 0 };
        }
      }),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          const timeoutError: ImageUploadError = {
            message: `Upload timed out after ${this.UPLOAD_TIMEOUT_MS / 1000} seconds`,
            code: 'TIMEOUT'
          };
          return throwError(() => timeoutError);
        }

        const errorResponse: ImageUploadError = {
          message: error.error?.message || error.message || 'Failed to upload image',
          code: error.status?.toString() || 'UNKNOWN'
        };
        return throwError(() => errorResponse);
      })
    );
  }

  validateImageFile(file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (!this.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: 'Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG)' };
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `Image size must be less than ${maxSizeMB}MB` };
    }

    if (file.size < this.MIN_IMAGE_SIZE) {
      return { valid: false, error: 'Image file appears to be corrupted or empty' };
    }

    if (!file.name?.trim()) {
      return { valid: false, error: 'Invalid file name' };
    }

    const fileName = file.name.toLowerCase();
    if (this.SUSPICIOUS_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
      return { valid: false, error: 'Invalid file type' };
    }

    return { valid: true };
  }

  getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const cleanup = {
        readerTimeout: null as any,
        imageTimeout: null as any
      };

      const clearAllTimeouts = () => {
        if (cleanup.readerTimeout) clearTimeout(cleanup.readerTimeout);
        if (cleanup.imageTimeout) clearTimeout(cleanup.imageTimeout);
      };

      const reader = new FileReader();
      
      cleanup.readerTimeout = setTimeout(() => {
        clearAllTimeouts();
        reader.abort();
        reject(new Error('File reading timed out'));
      }, this.DIMENSION_CHECK_TIMEOUT);
      
      reader.onload = (e) => {
        if (cleanup.readerTimeout) {
          clearTimeout(cleanup.readerTimeout);
        }
        
        const img = new Image();
        
        const handleImageLoad = () => {
          clearAllTimeouts();
          
          if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
            reject(new Error('Invalid image dimensions'));
            return;
          }

          if (img.naturalWidth > this.MAX_IMAGE_DIMENSION || img.naturalHeight > this.MAX_IMAGE_DIMENSION) {
            reject(new Error(`Image dimensions too large. Maximum: ${this.MAX_IMAGE_DIMENSION}px`));
            return;
          }
          
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        
        const handleImageError = () => {
          clearAllTimeouts();
          reject(new Error('Failed to load image'));
        };
        
        img.onload = handleImageLoad;
        img.onerror = handleImageError;
        
        cleanup.imageTimeout = setTimeout(() => {
          clearAllTimeouts();
          reject(new Error('Image loading timed out'));
        }, this.DIMENSION_CHECK_TIMEOUT);
        
        try {
          img.src = e.target?.result as string;
        } catch (error) {
          clearAllTimeouts();
          reject(new Error('Failed to create image'));
        }
      };
      
      reader.onerror = () => {
        clearAllTimeouts();
        reject(new Error('Failed to read file'));
      };
      
      try {
        reader.readAsDataURL(file);
      } catch (error) {
        clearAllTimeouts();
        reject(new Error('Failed to start file reading'));
      }
    });
  }
}