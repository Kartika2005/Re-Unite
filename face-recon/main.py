import cv2
import numpy as np
import io
import base64
import os
import logging

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from insightface.app import FaceAnalysis

# ---------------- CONFIG ----------------
THRESHOLD = 0.55
SKIP = 2

CCTVS = {
    "CCTV-01": "video.mp4",
    "CCTV-02": "video2.mp4"
}
# ---------------------------------------

# ---------------- LOGGING ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
log = logging.getLogger("cctv-scan")
# ----------------------------------------

app = FastAPI(title="CCTV Face Scan MVP")

# Serve static assets
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve dashboard on /
@app.get("/")
def serve_dashboard():
    return FileResponse("static/index.html")

# Load models once
log.info("🚀 Loading InsightFace models...")
face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=0, det_size=(640, 640))
log.info("✅ Models loaded")


def cosine(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def process_video(video_path, ref_emb, cam_name):
    log.info(f"📹 [{cam_name}] Starting scan")
    cap = cv2.VideoCapture(video_path)

    best_score = 0.0
    best_frame = None
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        if frame_idx % SKIP != 0:
            continue

        faces = face_app.get(frame)
        for face in faces:
            sim = cosine(ref_emb, face.embedding)
            if sim > best_score:
                best_score = sim
                best_frame = frame.copy()

    cap.release()

    if best_frame is None:
        log.info(f"❌ [{cam_name}] No face detected")
        return None, 0.0

    _, buffer = cv2.imencode(".png", best_frame)
    img_b64 = base64.b64encode(buffer).decode()

    log.info(f"🏁 [{cam_name}] Done — best score: {best_score:.3f}")
    return img_b64, best_score


@app.post("/embedding")
async def get_embedding(image: UploadFile = File(...)):
    """Extract a 512-dim face embedding from a single image."""
    log.info("🧬 Embedding extraction request received")

    raw = await image.read()
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)

    if img is None:
        return JSONResponse(status_code=400, content={"error": "Invalid image"})

    faces = face_app.get(img)
    if not faces:
        return JSONResponse(
            status_code=400,
            content={"error": "No face detected in image"},
        )

    emb = faces[0].embedding  # numpy array (512,)
    log.info("✅ Embedding extracted")

    return {"success": True, "embedding": emb.tolist()}


@app.post("/scan")
async def scan(image: UploadFile = File(...)):
    log.info("🧍 New scan request received")

    ref_bytes = await image.read()
    ref_img = cv2.imdecode(
        np.frombuffer(ref_bytes, np.uint8),
        cv2.IMREAD_COLOR
    )

    if ref_img is None:
        log.warning("⚠️ Invalid reference image")
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid image"}
        )

    ref_faces = face_app.get(ref_img)
    if not ref_faces:
        log.warning("⚠️ No face in reference image")
        return {
            "error": "No face detected in reference image"
        }

    ref_emb = ref_faces[0].embedding
    log.info("✅ Reference face encoded")

    results = {}

    for cam, video_path in CCTVS.items():
        if not os.path.exists(video_path):
            log.error(f"❌ [{cam}] Video file missing")
            results[cam] = {"status": "error"}
            continue

        img_b64, score = process_video(video_path, ref_emb, cam)

        if score >= THRESHOLD:
            results[cam] = {
                "status": "found",
                "score": round(float(score), 3),
                "image": img_b64
            }
        else:
            results[cam] = {
                "status": "not_found",
                "score": round(float(score), 3)
            }

    log.info("🎯 Scan completed")

    return {
        "scan_id": os.urandom(4).hex(),
        "results": results
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
