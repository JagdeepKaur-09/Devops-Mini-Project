import { Injectable } from '@angular/core';
import { API_BASE } from '../api.config';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  downloadPdf(imageUrls: string[]): void {
    if (!imageUrls.length) return;
    const downloadUrl = `${API_BASE}/photos/download-pdf?images=${imageUrls.join(',')}`;
    window.open(downloadUrl, '_blank');
  }
}
