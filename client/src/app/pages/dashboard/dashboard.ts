import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { API_BASE } from '../../api.config';

interface Room {
  _id: string;
  eventName: string;
  roomCode: string;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  rooms: Room[] = [];
  errorMsg = '';
  newRoomName = '';
  joinCode = '';
  foundRoom: Room | null = null;
  /** true only after a successful room search — hides My Rooms */
  searchActive = false;
  currentUserName = '';
  hasFaceRegistered = false;
  loading = true;

  constructor(
    private http: HttpClient,
    public router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    if (!localStorage.getItem('token')) { this.router.navigate(['/login']); return; }
    this.getRooms();
    this.loadCurrentUser();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  loadCurrentUser(): void {
    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((u: { name: string; email: string; hasFace: boolean }) => {
        this.currentUserName = u.name;
        this.hasFaceRegistered = u.hasFace;
        this.cdr.detectChanges();
      })
      .catch(() => { });
  }

  getRooms(): void {
    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_BASE}/rooms/my-rooms`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) return r.json().then((b: any) => Promise.reject({ status: r.status, body: b }));
        return r.json();
      })
      .then((res: Room[]) => {
        this.rooms = res;
        this.errorMsg = '';
        this.loading = false;
        this.cdr.detectChanges();
      })
      .catch((err) => {
        this.loading = false;
        if (err?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        } else {
          this.errorMsg = err?.body?.error ?? 'Failed to load rooms.';
        }
        this.cdr.detectChanges();
      });
  }

  createRoom(): void {
    if (!this.newRoomName.trim()) { this.errorMsg = 'Please enter an event name.'; return; }
    const dup = this.rooms.find(r => r.eventName.toLowerCase() === this.newRoomName.toLowerCase());
    if (dup) { this.errorMsg = 'A room with this name already exists.'; return; }
    this.errorMsg = '';

    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_BASE}/rooms/create`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: this.newRoomName })
    })
      .then(r => r.ok ? r.json() : r.json().then((b: any) => Promise.reject(b)))
      .then((res: { roomCode: string }) => {
        this.newRoomName = '';
        alert('Room created! Code: ' + res.roomCode);
        this.getRooms();
      })
      .catch((err) => {
        this.errorMsg = err?.error ?? 'Failed to create room.';
        this.cdr.detectChanges();
      });
  }

  enterRoom(): void {
    const code = this.joinCode.trim();

    if (!code) {
      this.errorMsg = 'Please enter a room code first.';
      this.foundRoom = null;
      this.searchActive = false;
      return;
    }

    this.errorMsg = '';
    this.foundRoom = null;

    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_BASE}/rooms/${code}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) return r.json().then((b: any) => Promise.reject({ status: r.status, body: b }));
        return r.json();
      })
      .then((room: Room) => {
        this.foundRoom = room;
        this.searchActive = true;
        this.cdr.detectChanges();
      })
      .catch((err) => {
        this.foundRoom = null;
        this.searchActive = false;
        if (err?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        } else if (err?.status === 404) {
          this.errorMsg = `No room found with code "${code}". Please check and try again.`;
        } else {
          this.errorMsg = `Error: ${err?.body?.error ?? 'Could not reach server. Is the backend running?'}`;
        }
        this.cdr.detectChanges();
      });
  }

  clearSearch(): void {
    this.joinCode = '';
    this.foundRoom = null;
    this.searchActive = false;
    this.errorMsg = '';
  }

  goToUpload(roomId: string): void {
    this.router.navigate(['/upload', roomId]);
  }

  goToRoom(roomCode: string): void {
    this.router.navigate(['/room', roomCode]);
  }

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}
