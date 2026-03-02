import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { API_BASE } from '../../api.config';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.html',
  styleUrl: './upload.css'
})
export class UploadComponent implements OnInit {
  selectedFiles: File[] = [];
  uploading = false;
  uploadedCount = 0;
  errorMsg = '';
  roomId = '';       // MongoDB _id — used for upload API
  roomCode = '';     // room code — used for navigation after upload
  roomName = '';     // display name

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    public router: Router
  ) { }

  ngOnInit(): void {
    if (!localStorage.getItem('token')) { this.router.navigate(['/login']); return; }

    this.roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
    if (!this.roomId) {
      this.errorMsg = 'Invalid room. Please go back to the dashboard.';
      return;
    }

    // Fetch room details to get roomCode for navigation after upload
    // We need to find the room by _id — use my-rooms and filter
    this.http.get<{ _id: string; eventName: string; roomCode: string }[]>(
      `${API_BASE}/rooms/my-rooms`, { headers: this.getHeaders() }
    ).subscribe({
      next: (rooms) => {
        const room = rooms.find(r => r._id === this.roomId);
        if (room) {
          this.roomCode = room.roomCode;
          this.roomName = room.eventName;
        } else {
          this.errorMsg = 'Room not found. You may not be the organizer.';
        }
      },
      error: () => { this.errorMsg = 'Failed to load room details.'; }
    });
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFiles = input.files ? Array.from(input.files) : [];
    this.errorMsg = '';
  }

  get uploadProgress(): number {
    if (this.selectedFiles.length === 0) return 0;
    return Math.round((this.uploadedCount / this.selectedFiles.length) * 100);
  }

  async uploadPhotos(): Promise<void> {
    if (this.selectedFiles.length === 0) { this.errorMsg = 'Please select at least one photo.'; return; }
    if (!this.roomId) { this.errorMsg = 'Room ID is missing.'; return; }

    this.uploading = true;
    this.uploadedCount = 0;
    this.errorMsg = '';

    for (const file of this.selectedFiles) {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('roomId', this.roomId);

      try {
        await new Promise<void>((resolve, reject) => {
          this.http.post(`${API_BASE}/photos/upload`, formData, {
            headers: this.getHeaders()
          }).subscribe({
            next: () => { this.uploadedCount++; resolve(); },
            error: (err) => reject(err)
          });
        });
      } catch (err: unknown) {
        const e = err as { error?: { error?: string } };
        this.errorMsg = `Failed on "${file.name}": ${e.error?.error ?? 'Unknown error'}`;
        this.uploading = false;
        return;
      }
    }

    this.uploading = false;
    // Navigate using roomCode (not roomId) — room route uses roomCode
    if (this.roomCode) {
      this.router.navigate(['/room', this.roomCode]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
