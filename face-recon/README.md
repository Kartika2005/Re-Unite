# Face Recognition Service (face-recon)

Python FastAPI microservice used by REUNITE to run face embedding extraction and CCTV matching.

## Stack

- Python 3.12+
- FastAPI + Uvicorn
- InsightFace (`buffalo_l`)
- OpenCV + NumPy

## What It Does

- Extracts 512-dimensional face embeddings from uploaded photos.
- Scans configured CCTV videos and returns best match per camera.
- Reports match status with confidence score and best frame image (base64 PNG).

## Current CCTV Configuration

Configured in `main.py`:

- `CCTV-01` -> `video.mp4`
- `CCTV-02` -> `video2.mp4`

Both files should exist in this folder for scan results to work.

## Setup

Using `uv`:

```bash
uv sync
uv run main.py
```

Service runs on: `http://localhost:8000`

## Endpoints

### `GET /`

- Serves the local static dashboard (`static/index.html`).

### `POST /embedding`

- Multipart form upload with field `image`.
- Returns:
	- `success: true`
	- `embedding`: array of 512 numbers

### `POST /scan`

- Multipart form upload with field `image` (reference face image).
- Runs matching against all configured CCTV feeds.
- Returns per-camera result with:
	- `status`: `found`, `not_found`, or `error`
	- `score`: similarity score
	- `image`: base64 PNG for best frame (only when found)

## Runtime Notes

- Threshold is currently `0.55`.
- Frame skip is currently `2` (`SKIP=2`) to speed up scanning.
- InsightFace model is loaded once at startup.

## Troubleshooting

- If model download/init fails, ensure internet access on first run.
- If no matches are found, validate reference image quality and visible face.
- If videos are missing, scan response marks that camera as `error`.
