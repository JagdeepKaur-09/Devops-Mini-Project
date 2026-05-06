import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { PhotoService } from '../../services/photo';
import { API_BASE } from '../../api.config';
import { io, Socket } from 'socket.io-client';

interface Photo {
  _id: string;
  cloudinaryUrl: string;
  status: string;
  roomId: string;
}

interface Room {
  _id: string;
  eventName: string;
  roomCode: string;
  status: string;
  organizerId: string;
}

interface MatchResult {
  matches: Photo[];
  maybe: Photo[];
}

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room.html',
  styleUrl: './room.css'
})
export class RoomComponent implements OnInit, OnDestroy {
  room: Room | null = null;
  photos: Photo[] = [];
  errorMsg = '';
  roomId = '';
  matchedPhotos: Photo[] = [];
  maybePhotos: Photo[] = [];
  isMatching = false;
  isProcessing = false;
  hasFaceRegistered = false;
  checkingFace = true;
  pageLoading = true;
  isOrganizer = false;

  private socket: Socket | null = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private photoService: PhotoService,
    public router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const roomCode = this.route.snapshot.paramMap.get('roomCode');
    if (!roomCode) {
      this.errorMsg = 'Invalid room URL.';
      this.pageLoading = false;
      this.cdr.detectChanges();
      return;
    }

    // Use native fetch to avoid Angular HttpClient zone issues
    this.loadRoomDirect(roomCode);

    // Check face registration
    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((res: { hasFace: boolean }) => {
        this.hasFaceRegistered = res.hasFace;
        this.checkingFace = false;
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.checkingFace = false;
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }

  /** Load room using native fetch + explicit change detection */
  private loadRoomDirect(roomCode: string): void {
    const token = localStorage.getItem('token') ?? '';
    console.log('[Room] Loading room:', roomCode);
    fetch(`${API_BASE}/rooms/${roomCode}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(body => Promise.reject({ status: res.status, body }));
        }
        return res.json();
      })
      .then((room: Room) => {
        console.log('[Room] Loaded:', room.eventName);
        this.room = room;
        this.roomId = room._id;
        this.pageLoading = false;
        this.isOrganizer = this.getCurrentUserId() === room.organizerId;
        this.cdr.detectChanges();
        this.loadPhotos(room._id);
        this.connectSocket(room._id);
      })
      .catch((err) => {
        console.error('[Room] Load error:', err);
        this.pageLoading = false;
        if (err?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        } else if (err?.status === 404) {
          this.errorMsg = `Room "${roomCode}" not found.`;
        } else {
          this.errorMsg = err?.body?.error ?? `Could not load room. Please check your connection.`;
        }
        this.cdr.detectChanges();
      });
  }

  private getCurrentUserId(): string {
    try {
      const token = localStorage.getItem('token') ?? '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId ?? '';
    } catch { return ''; }
  }

  // ── Socket.io ─────────────────────────────────────────────────────────────
  private connectSocket(roomId: string): void {
    try {
      // In dev (port 4200): connect directly to backend. In Docker: Nginx proxies /socket.io/
      const socketUrl = (window.location.hostname === 'localhost' && window.location.port === '4200')
        ? 'http://localhost:5000'
        : window.location.origin;
      this.socket = io(socketUrl, {
        transports: ['polling', 'websocket'],
        timeout: 5000,
        reconnectionAttempts: 3
      });
      this.socket.on('connect', () => this.socket!.emit('joinRoom', roomId));
      this.socket.on('connect_error', () => console.warn('Socket.io unavailable'));
      this.socket.on('photoProcessed', (data: { photoId: string; status: string }) => {
        const idx = this.photos.findIndex(p => p._id === data.photoId);
        if (idx !== -1) {
          this.photos = [
            ...this.photos.slice(0, idx),
            { ...this.photos[idx], status: data.status },
            ...this.photos.slice(idx + 1)
          ];
          this.isProcessing = this.photos.some(p => p.status === 'processing');
          this.cdr.detectChanges();
        }
      });
    } catch { console.warn('Socket.io init failed'); }
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  loadPhotos(roomId: string): void {
    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_BASE}/photos/${roomId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then((photos: Photo[]) => {
        const seen = new Set<string>();
        this.photos = photos.filter(p => {
          if (!p.cloudinaryUrl || seen.has(p.cloudinaryUrl)) return false;
          seen.add(p.cloudinaryUrl);
          return true;
        });
        this.isProcessing = this.photos.some(p => p.status === 'processing');
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.photos = [];
        this.isProcessing = false;
        this.cdr.detectChanges();
      });
  }

  trackPhoto(_: number, p: Photo): string { return p._id; }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="%232e3250"/><text x="50%" y="50%" fill="%238b92b8" text-anchor="middle" dy=".3em" font-size="12">Image unavailable</text></svg>';
  }

  get processedCount(): number {
    return this.photos.filter(p => p.status !== 'processing').length;
  }

  // ── Face matching ─────────────────────────────────────────────────────────
  findMyPhotos(): void {
    if (!this.hasFaceRegistered) { this.goToConsent(); return; }
    this.isMatching = true;
    this.matchedPhotos = [];
    this.maybePhotos = [];
    this.cdr.detectChanges();

    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_BASE}/photos/match/${this.roomId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : r.json().then((b: any) => Promise.reject(b)))
      .then((data: MatchResult) => {
        this.matchedPhotos = data.matches;
        this.maybePhotos = data.maybe;
        this.isMatching = false;
        this.cdr.detectChanges();
      })
      .catch((err) => {
        this.isMatching = false;
        this.errorMsg = err?.error ?? 'Error matching photos.';
        this.cdr.detectChanges();
      });
  }

  // ── Downloads ─────────────────────────────────────────────────────────────
  downloadImage(imageUrl: string, fileName: string): void {
    this.http.get(imageUrl, { responseType: 'blob' }).subscribe((blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    });
  }

  downloadAsPDF(): void {
    this.photoService.downloadPdf(this.matchedPhotos.map(p => p.cloudinaryUrl));
  }

  downloadAll(): void {
    this.photos.forEach((photo, i) => {
      setTimeout(() => {
        this.downloadImage(photo.cloudinaryUrl, `Event-${this.room?.eventName}-${i + 1}.jpg`);
      }, i * 200);
    });
  }

  goToUpload(): void { this.router.navigate(['/upload', this.roomId]); }
  goToConsent(): void { this.router.navigate(['/face-consent']); }
}
