import { MissingPersonRequest } from "../models/MissingPersonRequest.ts";
import { DuplicateAlert } from "../models/DuplicateAlert.ts";
import { CaseEvent } from "../models/CaseEvent.ts";
import { getIO, SocketEvents } from "../socket.ts";
import { sendDuplicateWhatsApp } from "../services/whatsappService.ts";
import type { DuplicateMatchType, DuplicateSeverity } from "../types/index.ts";

const FACE_RECON_URL =
  process.env.FACE_RECON_URL || "http://localhost:8000";

const SIMILARITY_THRESHOLD = 0.55;

// ─── Pure-JS cosine similarity ───────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Call face-recon /embedding endpoint ─────────────────
export async function extractEmbedding(
  photoUrl: string
): Promise<number[]> {
  const imageRes = await fetch(photoUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image from ${photoUrl}: ${imageRes.status}`);
  }
  const blob = await imageRes.blob();

  const formData = new FormData();
  formData.append("image", blob, "face.jpg");

  const res = await fetch(`${FACE_RECON_URL}/embedding`, {
    method: "POST",
    body: formData,
  });

  const data = (await res.json()) as {
    success?: boolean;
    embedding?: number[];
    error?: string;
  };

  if (data.error || !data.embedding) {
    throw new Error(data.error || "Failed to extract face embedding");
  }

  return data.embedding;
}

// ─── Severity from score / match type ────────────────────
function getSeverity(
  score: number,
  isAadhaarMatch: boolean
): DuplicateSeverity {
  if (isAadhaarMatch || score >= 0.85) return "CRITICAL";
  if (score >= 0.70) return "HIGH";
  return "MEDIUM";
}

// ─── Main duplicate-check pipeline ──────────────────────
export async function checkForDuplicates(newRequest: {
  _id: string;
  photoUrl: string;
  aadhaarNo?: string;
  name?: string;
  faceEmbedding: number[];
}): Promise<void> {
  const activeStatuses = ["REPORTED", "UNDER_REVIEW", "SCANNING"];

  // Fetch active cases WITH their embeddings
  const activeCases = await MissingPersonRequest.find({
    _id: { $ne: newRequest._id },
    status: { $in: activeStatuses },
    faceEmbedding: { $exists: true, $ne: [] },
  }).select("+faceEmbedding +aadhaarNo +name +photoUrl +status");

  const alerts: Array<{
    existingId: string;
    score: number;
    matchType: DuplicateMatchType;
    severity: DuplicateSeverity;
    existingName?: string;
    existingPhoto?: string;
  }> = [];

  // Set of existing IDs that matched via Aadhaar (to merge into BOTH)
  const aadhaarMatchIds = new Set<string>();

  // 1️⃣ Aadhaar exact-match check (deterministic)
  if (newRequest.aadhaarNo) {
    const aadhaarMatches = await MissingPersonRequest.find({
      _id: { $ne: newRequest._id },
      status: { $in: activeStatuses },
      aadhaarNo: newRequest.aadhaarNo,
    });

    for (const match of aadhaarMatches) {
      aadhaarMatchIds.add(match._id.toString());
    }
  }

  // 2️⃣ Face similarity check
  for (const existing of activeCases) {
    const existingEmb = (existing as any).faceEmbedding as number[];
    if (!existingEmb || existingEmb.length === 0) continue;

    const score = cosineSimilarity(newRequest.faceEmbedding, existingEmb);

    const existingIdStr = existing._id.toString();
    const isAadhaarMatch = aadhaarMatchIds.has(existingIdStr);

    if (score >= SIMILARITY_THRESHOLD || isAadhaarMatch) {
      const finalScore = isAadhaarMatch ? Math.max(score, 0.95) : score;
      const matchType: DuplicateMatchType =
        isAadhaarMatch && score >= SIMILARITY_THRESHOLD
          ? "BOTH"
          : isAadhaarMatch
            ? "AADHAAR"
            : "FACE";

      alerts.push({
        existingId: existingIdStr,
        score: finalScore,
        matchType,
        severity: getSeverity(finalScore, isAadhaarMatch),
        existingName: existing.name,
        existingPhoto: existing.photoUrl,
      });

      // Remove from aadhaar set since it's handled
      aadhaarMatchIds.delete(existingIdStr);
    }
  }

  // 3️⃣ Any remaining Aadhaar-only matches (no embedding on existing case)
  if (aadhaarMatchIds.size > 0) {
    const remaining = await MissingPersonRequest.find({
      _id: { $in: Array.from(aadhaarMatchIds) },
    });
    for (const match of remaining) {
      alerts.push({
        existingId: match._id.toString(),
        score: 0.95,
        matchType: "AADHAAR",
        severity: "CRITICAL",
        existingName: match.name,
        existingPhoto: match.photoUrl,
      });
    }
  }

  if (alerts.length === 0) return;

  // 4️⃣ Create DuplicateAlert records + CaseEvents + emit socket events
  for (const alert of alerts) {
    const dupAlert = await DuplicateAlert.create({
      newRequestId: newRequest._id,
      existingRequestId: alert.existingId,
      score: Math.round(alert.score * 1000) / 1000,
      matchType: alert.matchType,
      severity: alert.severity,
      status: "PENDING",
    });

    // Log event on both cases
    const detailMsg = `Potential duplicate detected (${alert.matchType}, ${Math.round(alert.score * 100)}% match) with case ${alert.existingId}`;

    await CaseEvent.create({
      requestId: newRequest._id,
      action: "DUPLICATE_DETECTED",
      details: detailMsg,
    });

    await CaseEvent.create({
      requestId: alert.existingId,
      action: "DUPLICATE_DETECTED",
      details: `Potential duplicate detected (${alert.matchType}, ${Math.round(alert.score * 100)}% match) with new case ${newRequest._id}`,
    });

    // Real-time alert to police
    getIO().emit(SocketEvents.DUPLICATE_DETECTED, {
      alert: dupAlert.toObject(),
      newRequest: {
        _id: newRequest._id,
        name: newRequest.name,
        photoUrl: newRequest.photoUrl,
      },
      existingRequest: {
        _id: alert.existingId,
        name: alert.existingName,
        photoUrl: alert.existingPhoto,
      },
    });

    // WhatsApp for critical duplicates
    if (alert.severity === "CRITICAL") {
      sendDuplicateWhatsApp({
        newCaseId: newRequest._id,
        newName: newRequest.name,
        newPhotoUrl: newRequest.photoUrl,
        existingCaseId: alert.existingId,
        existingName: alert.existingName,
        score: alert.score,
        matchType: alert.matchType,
      }).catch((err) =>
        console.error("Failed to send duplicate WhatsApp:", err)
      );
    }
  }

  console.log(
    `⚠️  ${alerts.length} duplicate alert(s) created for case ${newRequest._id}`
  );
}
