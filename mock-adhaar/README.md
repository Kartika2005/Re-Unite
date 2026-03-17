# Mock Aadhaar Service

Lightweight Bun service that simulates Aadhaar lookup for local development.

## Purpose

- Provides deterministic test identity data for Aadhaar-based missing person reports.
- Used by backend police flow to fetch identity details from `aadhaar_cards.json`.

## Run

```bash
bun install
bun run dev
```

Default URL: `http://localhost:4000`

## API

### Find Aadhaar card

- Method: `GET`
- Path: `/find`
- Query param: `adhaarno`

Example:

`GET /find?adhaarno=1234%205678%209012`

Responses:

- `200` with matching card object
- `404` when no match exists
- `400` when `adhaarno` query param is missing

## Data Source

- `aadhaar_cards.json` is the in-repo dataset used for lookups.
- Spaces in Aadhaar number are normalized before matching.
