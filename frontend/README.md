# REUNITE Frontend

React + TypeScript + Vite application for citizen and police workflows.

## Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v4
- shadcn/ui + Radix primitives
- Lucide icons
- React Router
- Socket.IO client for real-time case updates
- Leaflet + React Leaflet for map views

## Features Implemented

- Role-based authenticated app shell with collapsible sidebar
- Citizen flows: report missing person, my requests, bounty payment flow
- Police flows: dashboard, request detail investigation, scan results, notes, duplicate alerts
- Public flows: tip page, case map, AI chat, bounty result page
- Real-time UI updates via WebSocket events

## Project Structure

```text
frontend/
├── src/
│   ├── api/                # Typed API client wrappers
│   ├── assets/
│   ├── components/
│   │   ├── ui/             # shadcn/ui primitives
│   │   └── ...             # app-level shared components
│   ├── context/            # Auth context/provider
│   ├── hooks/              # useSocket, use-mobile
│   ├── lib/                # utility helpers (cn, etc.)
│   ├── pages/
│   │   ├── citizen/
│   │   ├── police/
│   │   └── ...             # Chat, CaseMap, TipPage, AuthPages...
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── components.json         # shadcn config
├── package.json
└── vite.config.ts
```

## Scripts

```bash
bun install
bun run dev      # start dev server
bun run build    # type-check + production build
bun run lint     # eslint
bun run preview  # preview production build
```

Dev server runs on `http://localhost:5173` by default.

## Environment Variables

Create `.env` in this folder:

```env
VITE_API_URL=http://localhost:3001/api
VITE_GEOAPIFY_KEY=your_geoapify_key
```

## Notes

- Leaflet CSS is imported in `src/main.tsx`.
- If backend URL/port changes, update `VITE_API_URL`.
