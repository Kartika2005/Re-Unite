# REUNITE Backend

Express + TypeScript API server running on Bun.

## Stack

- Bun runtime
- Express 5
- MongoDB + Mongoose
- Socket.IO
- JWT auth
- Cloudinary uploads
- Groq integration (chat + speech services)
- PhonePe bounty payment integration

## Project Structure

```text
backend/
├── src/
│   ├── controllers/        # auth, citizen, police, public, chat, bounty
│   ├── middlewares/        # auth guard, upload middleware
│   ├── models/             # mongo schemas
│   ├── routes/             # route wiring
│   ├── services/           # face scan, cloudinary, groq, phonepe, whatsapp
│   ├── types/
│   ├── index.ts            # app bootstrap
│   ├── socket.ts           # socket server setup
│   └── seed.ts             # local seed data
├── docker-compose.yml      # local MongoDB
├── package.json
└── tsconfig.json
```

## Scripts

```bash
bun install
bun run dev      # watch mode dev server
bun run start    # run API once
bun run seed     # reset + seed users and sample cases
bun run build    # build output to dist/
```

Default API URL: `http://localhost:3001`

## Local Setup

1. Start MongoDB

```bash
docker compose up -d
```

2. Configure env variables (`backend/.env`)
3. Run seed (optional for demo credentials)
4. Start server

## Environment Variables

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/reunite
JWT_SECRET=your-secret-key

FACE_RECON_URL=http://localhost:8000
MOCK_AADHAAR_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Groq
GROQ_API_KEY=

# PhonePe
PHONEPE_CLIENT_ID=
PHONEPE_CLIENT_SECRET=
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENV=SANDBOX
PHONEPE_REDIRECT_URL=http://localhost:5173/bounty-result
PHONEPE_CALLBACK_URL=http://localhost:3001/api/bounty/callback

# WhatsApp (optional)
WHATSAPP_API_URL=https://gate.whapi.cloud
WHATSAPP_AUTH_TOKEN=
WHATSAPP_RECIPIENT=

# Optional reverse-geocode for WhatsApp captions
GEOAPIFY_KEY=
```

## Seeded Demo Credentials

- Citizen: `citizen@reunite.com` / `citizen123`
- Police: `police@reunite.com` / `police123`

## API Base Routes

- `/api/auth`
- `/api/requests`
- `/api/police`
- `/api/public`
- `/api/chat`
- `/api/bounty`
- `/api/health`

## Notes

- Scans are orchestrated here but executed by the face-recon service.
- Socket.IO is initialized in `src/socket.ts` and attached to the same HTTP server.

