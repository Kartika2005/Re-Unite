import type { IScanResult } from "../types/index.ts";

const FACE_RECON_URL =
  process.env.FACE_RECON_URL || "http://localhost:8000";

interface FaceReconCameraResult {
  status: "found" | "not_found" | "error";
  score: number;
  image?: string; // base64 PNG, only present when status === "found"
}

interface FaceReconResponse {
  scan_id: string;
  results: Record<string, FaceReconCameraResult>;
  error?: string;
}

/**
 * Calls the face-recon FastAPI service to scan CCTV feeds
 * against the missing person's photo.
 *
 * 1. Fetches the reference image from photoUrl
 * 2. Sends it as multipart form data to POST /scan
 * 3. Maps per-camera results into ScanResult documents
 */
export async function callFaceRecognitionAPI(
  photoUrl: string,
  requestId: string
): Promise<Omit<IScanResult, "_id" | "createdAt">[]> {
  // Fetch the reference image
  const imageResponse = await fetch(photoUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to fetch reference image from ${photoUrl}: ${imageResponse.status}`
    );
  }

  const imageBlob = await imageResponse.blob();

  // Build multipart form
  const formData = new FormData();
  formData.append(
    "image",
    imageBlob,
    "reference.jpg"
  );

  // Call the face-recon service
  let response: Response;
  try {
    response = await fetch(`${FACE_RECON_URL}/scan`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    throw new Error(
      `Face recognition service unavailable at ${FACE_RECON_URL}: ${(err as Error).message}`
    );
  }

  const data = (await response.json()) as FaceReconResponse;

  // Handle face-recon level errors (e.g. "No face detected in reference image")
  if (data.error) {
    throw new Error(`No face detected in the uploaded image`);
  }

  if (!data.results || Object.keys(data.results).length === 0) {
    throw new Error("Face recognition service returned no results");
  }

  // Map each camera result to our ScanResult shape
  const scanResults: Omit<IScanResult, "_id" | "createdAt">[] = [];

  for (const [cctvId, cam] of Object.entries(data.results)) {
    scanResults.push({
      requestId,
      cctvId,
      status: cam.status,
      confidenceScore: Math.round(cam.score * 100 * 100) / 100, // 0–1 → percentage with 2 decimals
      bestMatchImageUrl:
        cam.status === "found" && cam.image
          ? `data:image/png;base64,${cam.image}`
          : "",
    });
  }

  return scanResults;
}

