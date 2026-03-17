import type { Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth.ts";
import { MissingPersonRequest } from "../models/MissingPersonRequest.ts";
import { CaseEvent } from "../models/CaseEvent.ts";
import { uploadImage } from "../services/cloudinaryService.ts";
import { getIO, SocketEvents } from "../socket.ts";
import {
  extractEmbedding,
  checkForDuplicates,
} from "../services/faceEmbeddingService.ts";
import { BountyTransaction } from "../models/BountyTransaction.ts";
import { AssociatedFamilyMember } from "../models/AssociatedFamilyMember.ts";
import type { CaptureRfidDTO, CreateFamilyMemberDTO } from "../types/index.ts";

const RFID_SESSION_TTL_MS = 60 * 1000;
const rfidSessions = new Map<string, { expiresAt: number }>();
const RFID_TAP_TTL_MS = 2 * 60 * 1000;
const latestRfidTapByCitizen = new Map<
  string,
  { rfidTagId: string; detectedAt: number }
>();

function normalizeRfid(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "-");
}

function cleanupExpiredRfidSessions() {
  const now = Date.now();
  for (const [sessionId, session] of rfidSessions.entries()) {
    if (session.expiresAt < now) {
      rfidSessions.delete(sessionId);
    }
  }
}

function cleanupExpiredRfidTaps() {
  const now = Date.now();
  for (const [citizenId, tap] of latestRfidTapByCitizen.entries()) {
    if (tap.detectedAt + RFID_TAP_TTL_MS < now) {
      latestRfidTapByCitizen.delete(citizenId);
    }
  }
}

/** Strip Aadhaar-sensitive fields from citizen-facing responses */
function stripSensitiveFields(doc: any) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.aadhaarNo;
  delete obj.phoneNumber;
  delete obj.address;
  return obj;
}

export async function createMissingPersonRequest(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      name,
      gender,
      dateOfBirth,
      bloodGroup,
      lastKnownLocation,
      aadhaarNo,
      bountyAmount,
    } = req.body;

    const location =
      typeof lastKnownLocation === "string"
        ? JSON.parse(lastKnownLocation)
        : lastKnownLocation;

    // Aadhaar-based report: only needs aadhaarNo + bloodGroup + location + photo
    const isAadhaarReport = !!aadhaarNo;

    if (!isAadhaarReport) {
      if (!name || !gender || !dateOfBirth || !bloodGroup || !location) {
        res.status(400).json({ error: "All fields are required" });
        return;
      }
    } else {
      if (!bloodGroup || !location) {
        res
          .status(400)
          .json({ error: "Blood group and location are required" });
        return;
      }
      // Validate aadhaar format: 12 digits (spaces stripped)
      const cleanAadhaar = aadhaarNo.replace(/\s/g, "");
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        res.status(400).json({ error: "Invalid Aadhaar number format" });
        return;
      }
    }

    if (
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      res
        .status(400)
        .json({ error: "Valid latitude and longitude are required" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Photo file is required" });
      return;
    }

    const photoUrl = await uploadImage(req.file.buffer);

    const requestData: Record<string, unknown> = {
      reporterId: req.user!.userId,
      bloodGroup,
      lastKnownLocation: location,
      photoUrl,
      status: "REPORTED",
    };

    if (isAadhaarReport) {
      requestData.aadhaarNo = aadhaarNo.replace(/\s/g, "");
    } else {
      requestData.name = name;
      requestData.gender = gender;
      requestData.dateOfBirth = new Date(dateOfBirth);
    }

    // Bounty pledge (optional)
    const parsedBounty = Number(bountyAmount);
    if (parsedBounty > 0) {
      requestData.bountyAmount = parsedBounty;
      requestData.bountyStatus = "PLEDGED";
    }

    const request = await MissingPersonRequest.create(requestData);

    await CaseEvent.create({
      requestId: request._id.toString(),
      action: "REPORT_CREATED",
      actor: req.user!.userId,
      details: isAadhaarReport
        ? "Missing person report created via Aadhaar"
        : `Missing person report created for ${name}`,
    });

    // Real-time update — new report shows on police dashboard
    getIO().emit(SocketEvents.REQUEST_CREATED, {
      request: request.toObject(),
    });

    res.status(201).json(stripSensitiveFields(request));

    // Create bounty transaction record if pledged
    if (parsedBounty > 0) {
      BountyTransaction.create({
        requestId: request._id.toString(),
        reporterId: req.user!.userId,
        amount: parsedBounty,
        status: "PLEDGED",
      }).catch((err: unknown) => console.error("Bounty create error:", err));
    }

    // ── Fire-and-forget: extract embedding + check duplicates ──
    (async () => {
      try {
        const embedding = await extractEmbedding(photoUrl);
        await MissingPersonRequest.updateOne(
          { _id: request._id },
          { faceEmbedding: embedding },
        );
        console.log(`🧬 Embedding saved for case ${request._id}`);

        await checkForDuplicates({
          _id: request._id.toString(),
          photoUrl,
          aadhaarNo: isAadhaarReport
            ? (requestData.aadhaarNo as string)
            : undefined,
          name: requestData.name as string | undefined,
          faceEmbedding: embedding,
        });
      } catch (err) {
        console.error("Duplicate check failed (non-blocking):", err);
      }
    })();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Create request error:", errMsg, error);
    res.status(500).json({ error: errMsg || "Internal server error" });
  }
}

export async function getMyRequests(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const requests = await MissingPersonRequest.find({
      reporterId: req.user!.userId,
    }).sort({ createdAt: -1 });

    res.json(requests.map(stripSensitiveFields));
  } catch (error) {
    console.error("Get my requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function activateRfidCapture(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  cleanupExpiredRfidSessions();
  const sessionId = crypto.randomUUID();

  rfidSessions.set(sessionId, {
    expiresAt: Date.now() + RFID_SESSION_TTL_MS,
  });

  res.json({
    sessionId,
    expiresInMs: RFID_SESSION_TTL_MS,
    captureRoute: "/api/requests/family-members/rfid/capture",
  });
}

export async function captureRfidTag(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  cleanupExpiredRfidSessions();
  const { sessionId, tagId } = req.body as CaptureRfidDTO;

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const session = rfidSessions.get(sessionId);
  if (!session) {
    res.status(400).json({ error: "Invalid or expired RFID session" });
    return;
  }

  const generatedTag = `RFID-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const capturedTag = normalizeRfid(tagId || generatedTag);

  rfidSessions.delete(sessionId);
  res.json({ rfidTagId: capturedTag });
}

export async function ingestDeviceRfidTap(
  req: Request,
  res: Response,
): Promise<void> {
  cleanupExpiredRfidTaps();

  const citizenId = String(req.body?.citizenId || "").trim();
  const tagIdRaw = String(req.body?.tagId || "").trim();

  if (!citizenId || !tagIdRaw) {
    res.status(400).json({ error: "citizenId and tagId are required" });
    return;
  }

  if (!/^[a-fA-F0-9]{24}$/.test(citizenId)) {
    res.status(400).json({ error: "citizenId must be a valid ObjectId" });
    return;
  }

  const rfidTagId = normalizeRfid(tagIdRaw);
  latestRfidTapByCitizen.set(citizenId, {
    rfidTagId,
    detectedAt: Date.now(),
  });

  res.json({ success: true, citizenId, rfidTagId });
}

export async function getLatestDeviceRfidTap(
  req: Request,
  res: Response,
): Promise<void> {
  cleanupExpiredRfidTaps();

  const citizenId = String(req.params.citizenId || "").trim();
  if (!/^[a-fA-F0-9]{24}$/.test(citizenId)) {
    res.status(400).json({ error: "citizenId must be a valid ObjectId" });
    return;
  }

  const tap = latestRfidTapByCitizen.get(citizenId);
  if (!tap) {
    res.json({ rfidTagId: null });
    return;
  }

  // One-time consume so UI auto-fills once per tap.
  latestRfidTapByCitizen.delete(citizenId);
  res.json({ rfidTagId: tap.rfidTagId });
}

export async function createAssociatedFamilyMember(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      fullName,
      relation,
      gender,
      dateOfBirth,
      bloodGroup,
      emergencyContact,
      rfidTagId,
      notes,
    } = req.body as CreateFamilyMemberDTO;

    if (!fullName || !relation || !rfidTagId) {
      res
        .status(400)
        .json({ error: "fullName, relation, and rfidTagId are required" });
      return;
    }

    const normalizedTagId = normalizeRfid(rfidTagId);

    const existingTag = await AssociatedFamilyMember.findOne({
      rfidTagId: normalizedTagId,
    });

    if (existingTag) {
      res.status(409).json({ error: "RFID tag is already registered" });
      return;
    }

    const familyMember = await AssociatedFamilyMember.create({
      citizenId: req.user!.userId,
      fullName: fullName.trim(),
      relation: relation.trim(),
      gender: gender?.trim() || undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      bloodGroup: bloodGroup?.trim() || undefined,
      emergencyContact: emergencyContact?.trim() || undefined,
      rfidTagId: normalizedTagId,
      notes: notes?.trim() || undefined,
    });

    res.status(201).json(familyMember.toObject());
  } catch (error) {
    console.error("createAssociatedFamilyMember error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAssociatedFamilyMembers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const members = await AssociatedFamilyMember.find({
      citizenId: req.user!.userId,
    }).sort({ createdAt: -1 });

    res.json(members);
  } catch (error) {
    console.error("getAssociatedFamilyMembers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
