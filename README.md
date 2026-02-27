# REUNITE — Missing Person Recovery Platform

**An MVP platform enabling citizens to report missing persons and police to investigate cases using AI-assisted face matching, with strict human-in-the-loop controls.**

## 🎯 Overview

REUNITE follows a **human-in-the-loop** approach where AI assists but police make final decisions. The platform uses face recognition to scan CCTV footage and match missing persons, while maintaining clear role-based access control and a strict state-driven workflow.

## 🧩 Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript (Bun runtime)
- **Database**: MongoDB + Mongoose
- **Face Recognition**: FastAPI + InsightFace (Python)
- **Auth**: JWT-based with role-based access control

## 📁 Project Structure

```
reunite-revamp/
├── backend/           # Express API server
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middlewares/
│   │   └── types/
│   └── docker-compose.yml
├── frontend/          # React UI
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/
│       ├── api/
│       └── types/
└── face-recon/        # Face recognition service
    ├── main.py
    └── static/
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (for backend & frontend)
- [Docker](https://www.docker.com) (for MongoDB)
- [uv](https://github.com/astral-sh/uv) (for Python face-recon service)
- Python 3.12

### 1. Start MongoDB

```bash
cd backend
docker compose up -d
```

### 2. Start Backend API

```bash
cd backend

# Install dependencies
bun install

# Seed test data (creates users & sample reports)
bun run seed

# Start development server
bun run dev
```

Backend runs on **http://localhost:3001**

### 3. Start Face Recognition Service

```bash
cd face-recon

# Sync dependencies (first time only)
uv sync

# Start FastAPI server
uv run main.py
```

Face-recon runs on **http://localhost:8000**

**Note**: Ensure `video.mp4` and `video2.mp4` exist in the `face-recon/` directory for scanning to work.

### 4. Start Frontend

```bash
cd frontend

# Install dependencies
bun install

# Start development server
bun run dev
```

Frontend runs on **http://localhost:5173**

## 🔑 Default Credentials

Created by `bun run seed` in the backend:

- **Citizen**: `citizen@reunite.com` / `citizen123`
- **Police**: `police@reunite.com` / `police123`

## 👥 User Roles & Capabilities

### Citizen
- Report missing persons
- View status of own requests
- Cannot see scan results or police notes

### Police
- View all requests (filterable by status)
- Move requests through workflow states
- Trigger face scans on CCTV footage
- View AI match results with confidence scores
- Add investigation notes
- Mark cases as FOUND or DECLINED
- Discard invalid reports

## 🔁 Request State Machine

Requests follow this strict state flow:

```
REPORTED → UNDER_REVIEW → SCANNING → FOUND | DECLINED
          ↓
       DISCARDED
```

**Rules**:
- Only police can transition states
- Scans can only be triggered when status = `UNDER_REVIEW`
- Police notes are mandatory before marking `FOUND` or `DECLINED`
- AI scan results do NOT auto-resolve requests

## 🧠 Face Recognition Integration

The face-recon service:
1. Accepts a reference image (missing person's photo)
2. Scans multiple CCTV video feeds in parallel
3. Returns per-camera results with:
   - Match status (`found` / `not_found` / `error`)
   - Confidence score (0–100%)
   - Best match frame (as base64 PNG when found)

Results are stored in MongoDB and displayed in the police dashboard with visual indicators.

## 📡 API Overview

### Authentication
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

### Citizen Endpoints
- `POST /api/requests` — Report missing person
- `GET /api/requests/me` — Get my reports

### Police Endpoints
- `GET /api/police/requests` — List all requests (filterable)
- `GET /api/police/requests/:id` — Get request details
- `PATCH /api/police/requests/:id/status` — Update status
- `PATCH /api/police/requests/:id/discard` — Discard request
- `POST /api/police/requests/:id/scan` — Trigger face scan
- `POST /api/police/requests/:id/note` — Add police note
- `GET /api/police/requests/:id/scans` — Get scan results

## 🏗️ Architecture Highlights

- **Strict TypeScript**: No JavaScript anywhere
- **Type-safe API layer**: Shared types between frontend and backend
- **State validation**: Server enforces valid state transitions
- **Role-based middleware**: Route protection by user role
- **Multi-camera scanning**: Parallel CCTV processing with per-camera results
- **Human verification**: AI suggests, police decides

## 🧪 Development

### Backend
```bash
cd backend
bun run dev        # Start with hot reload
bun run seed       # Reset database with test data
```

### Frontend
```bash
cd frontend
bun run dev        # Start with HMR
bun run build      # Production build
```

### Face Recognition
```bash
cd face-recon
uv run main.py     # Start with auto-reload
```

## 📝 Environment Variables

### Backend (`backend/.env`)
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/reunite
JWT_SECRET=your-secret-key
FACE_RECON_URL=http://localhost:8000
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001/api
```

## 🔒 Core Principles

1. **Human-in-the-loop**: AI assists, police decides
2. **Role-based access control**: Citizen vs Police capabilities
3. **State-driven workflow**: Clear request lifecycle
4. **MVP-first**: Simple, extensible architecture
5. **TypeScript everywhere**: Type safety across the stack

## 📄 License

MIT

---

**Built with ❤️ for safer communities**
