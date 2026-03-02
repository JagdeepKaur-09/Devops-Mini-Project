import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import * as faceapi from 'face-api.js';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { API_BASE } from '../../api.config';

type Mode = 'upload' | 'camera';

@Component({
  selector: 'app-register-face',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './register-face.html',
  styleUrl: './register-face.css'
})
export class RegisterFaceComponent implements OnInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  mode: Mode = 'upload';
  modelsReady = false;
  capturing = false;
  statusMessage = '';
  previewUrl = '';
  debugInfo = '';
  registered = false;        // true after registering in this session
  alreadyRegistered = false; // true if face was registered in a previous session
  private stream: MediaStream | null = null;

  constructor(private http: HttpClient, public router: Router) { }

  ngOnInit(): void {
    if (!localStorage.getItem('token')) { this.router.navigate(['/login']); return; }
    if (!localStorage.getItem('faceConsentGiven')) { this.router.navigate(['/face-consent']); return; }

    // Check if face is already registered
    const headers = new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
    this.http.get<{ hasFace: boolean }>(`${API_BASE}/auth/me`, { headers })
      .subscribe({
        next: (res) => {
          if (res.hasFace) {
            this.alreadyRegistered = true;  // show "already registered" screen
          } else {
            this.loadModelsBackground();    // only load models if needed
          }
        },
        error: () => this.loadModelsBackground()  // fallback — proceed normally
      });
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  // ── Load models without blocking UI ─────────────────────────────
  loadModelsBackground(): void {
    if (faceapi.nets.tinyFaceDetector.isLoaded &&
      faceapi.nets.faceLandmark68Net.isLoaded &&
      faceapi.nets.faceRecognitionNet.isLoaded) {
      this.modelsReady = true;
      return;
    }

    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models'),
    ]).then(() => {
      this.modelsReady = true;
      this.statusMessage = '';
    }).catch((err: unknown) => {
      console.error('[RegisterFace] Model load error:', err);
      this.statusMessage = 'Failed to load AI models. Please refresh.';
    });
  }

  // ── Mode switching ───────────────────────────────────────────────
  switchMode(m: Mode): void {
    this.mode = m;
    this.previewUrl = '';
    this.debugInfo = '';
    this.statusMessage = '';
    if (m === 'camera') {
      setTimeout(() => this.startVideo(), 150);
    } else {
      this.stopCamera();
    }
  }

  // ── Camera ───────────────────────────────────────────────────────
  startVideo(): void {
    if (!this.videoRef) return;
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      .then(stream => {
        this.stream = stream;
        this.videoRef.nativeElement.srcObject = stream;
        this.videoRef.nativeElement.play();
      })
      .catch((err: Error) => {
        this.statusMessage = 'Camera error: ' + err.message;
      });
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  async captureFromCamera(): Promise<void> {
    if (this.capturing) return;
    if (!this.modelsReady) { this.statusMessage = 'AI models still loading, please wait...'; return; }

    const video = this.videoRef?.nativeElement;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      this.statusMessage = 'Camera not ready. Please wait a moment.';
      return;
    }
    this.capturing = true;
    this.statusMessage = 'Scanning face...';

    const canvas = this.canvasRef.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    await this.detectAndSave(canvas);
  }

  // ── Upload from device ───────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.statusMessage = 'Please select an image file.'; return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl = e.target?.result as string;
      this.statusMessage = '';
    };
    reader.readAsDataURL(file);
  }

  async registerFromUpload(): Promise<void> {
    if (this.capturing || !this.previewUrl) return;
    if (!this.modelsReady) { this.statusMessage = 'AI models still loading, please wait a moment...'; return; }

    this.capturing = true;
    this.statusMessage = 'Scanning face in image...';

    const img = new Image();
    img.src = this.previewUrl;
    await new Promise<void>(res => { img.onload = () => res(); });

    const canvas = this.canvasRef.nativeElement;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    await this.detectAndSave(canvas);
  }

  // ── Shared detection ─────────────────────────────────────────────
  private async detectAndSave(canvas: HTMLCanvasElement): Promise<void> {
    try {
      let detection = null;
      for (const inputSize of [320, 416, 512, 608]) {
        detection = await faceapi
          .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection) {
          this.debugInfo = `score: ${detection.detection.score.toFixed(2)}`;
          break;
        }
      }

      if (!detection) {
        this.statusMessage = 'No face detected. Use a clear, well-lit, front-facing photo.';
        this.capturing = false;
        return;
      }

      this.statusMessage = 'Face detected! Saving...';
      this.saveToDatabase(Array.from(detection.descriptor));
    } catch (err: unknown) {
      console.error('[RegisterFace] Detection error:', err);
      this.statusMessage = 'Detection error. Please try again.';
      this.capturing = false;
    }
  }

  private saveToDatabase(faceDescriptor: number[]): void {
    const headers = new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
    this.http.post(`${API_BASE}/auth/register-face`, { faceDescriptor }, { headers })
      .subscribe({
        next: () => {
          this.capturing = false;
          this.registered = true;   // show success screen
          this.stopCamera();
          // Redirect to dashboard after 3 seconds
          setTimeout(() => this.router.navigate(['/dashboard']), 3000);
        },
        error: (err) => {
          console.error('[RegisterFace] Save error:', err);
          this.capturing = false;
          this.statusMessage = 'Save failed: ' + (err.error?.error ?? 'Unknown error');
        }
      });
  }
}
