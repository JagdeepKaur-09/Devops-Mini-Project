# EventSnap AI

Face recognition based event photo sharing. Participants automatically see only their own photos.

## How it works

1. Organizer creates a room and uploads all event photos
2. Participants register their face once via webcam
3. AI matches their face to every photo in the room
4. Each participant sees only the photos they appear in
5. Download individually or as a PDF

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone components) |
| Backend | Node.js + Express 5 |
| Database | MongoDB Atlas + Mongoose |
| AI | face-api.js (TinyFaceDetector) |
| Storage | Cloudinary |
| Queue | Bull + Redis |
| Real-time | Socket.io |
| Auth | JWT + bcryptjs |

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd Find-your-event-pic-AI

# Backend
npm install

# Frontend
cd client && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your MongoDB, Cloudinary, and JWT values
```

### 3. Download face-api.js models

```bash
node scripts/download-models.js
```

This downloads the AI weight files to both `models/` (backend) and `client/src/assets/models/` (frontend).

### 4. Start Redis

```bash
# Windows (WSL) or Linux/Mac
redis-server
```

### 5. Run

```bash
# Backend (port 5000)
npm start

# Frontend (port 4200) — separate terminal
cd client && npm start
```

Open `http://localhost:4200`

---

## Deployment

### Backend → Railway

1. Push to GitHub
2. Create new Railway project → Deploy from GitHub
3. Add Redis plugin in Railway dashboard
4. Set environment variables (copy from `.env.example`)
5. Railway auto-detects `Procfile` and runs `node server.js`

### Frontend → Netlify

1. Update `API_BASE` in `client/src/app/api.config.ts` to your Railway URL
2. Run `cd client && npm run build`
3. Drag `dist/client/browser` folder to Netlify, or connect GitHub repo
4. `netlify.toml` handles SPA routing automatically

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get profile + face status |
| POST | `/api/auth/register-face` | Yes | Save face descriptor |
| DELETE | `/api/auth/my-face` | Yes | Delete face data |
| POST | `/api/rooms/create` | Yes | Create event room |
| GET | `/api/rooms/my-rooms` | Yes | List organizer's rooms |
| GET | `/api/rooms/:roomCode` | Yes | Get room by code |
| POST | `/api/photos/upload` | Yes | Upload photo (organizer) |
| GET | `/api/photos/:roomId` | Yes | Get all photos in room |
| GET | `/api/photos/match/:roomId` | Yes | Find user's photos |
| GET | `/api/photos/download-pdf` | Yes | Download matched photos as PDF |
| DELETE | `/api/photos/:photoId` | Yes | Delete photo (organizer) |

---

## Privacy

- Face data is stored as 128 numbers — never as images
- Auto-deleted after 7 days via scheduled cron job
- Users can delete their own face data at any time via `DELETE /api/auth/my-face`
- Biometric consent screen shown before face registration
