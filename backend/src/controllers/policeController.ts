import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.ts";
import { MissingPersonRequest } from "../models/MissingPersonRequest.ts";
import { PoliceNote } from "../models/PoliceNote.ts";
import { ScanResult } from "../models/ScanResult.ts";
import { Tip } from "../models/Tip.ts";
import { CaseEvent } from "../models/CaseEvent.ts";
import { DuplicateAlert } from "../models/DuplicateAlert.ts";
import { callFaceRecognitionAPI } from "../services/faceScanService.ts";
import { sendWhatsAppNotification } from "../services/whatsappService.ts";
import { getIO, SocketEvents } from "../socket.ts";
import {
  VALID_TRANSITIONS,
  type AddPoliceNoteDTO,
  type RequestStatus,
  type UpdateRequestStatusDTO,
} from "../types/index.ts";

const MOCK_AADHAAR_URL =
  process.env.MOCK_AADHAAR_URL || "http://localhost:4000";

export async function getAllRequests(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status && typeof status === "string") {
      filter.status = status;
    }

    const requests = await MissingPersonRequest.find(filter).sort({
      createdAt: -1,
    });
    res.json(requests);
  } catch (error) {
    console.error("Get all requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateRequestStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body as UpdateRequestStatusDTO;

    const request = await MissingPersonRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const currentStatus = request.status as RequestStatus;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes(status)) {
      res.status(400).json({
        error: `Cannot transition from ${currentStatus} to ${status}`,
        allowedTransitions,
      });
      return;
    }

    // Require a police note for terminal states (FOUND, DECLINED)
    if (status === "FOUND" || status === "DECLINED") {
      const notes = await PoliceNote.find({ requestId: id });
      if (notes.length === 0) {
        res.status(400).json({
          error: "A police note is required before resolving a request",
        });
        return;
      }
    }

    request.status = status;
    await request.save();

    await CaseEvent.create({
      requestId: id,
      action: "STATUS_CHANGED",
      actor: req.user!.userId,
      details: `Status changed from ${currentStatus} to ${status}`,
    });

    // Send WhatsApp notification for key status changes
    if (["UNDER_REVIEW", "FOUND", "DECLINED"].includes(status)) {
      sendWhatsAppNotification({
        name: request.name,
        aadhaarNo: request.aadhaarNo,
        gender: request.gender,
        dateOfBirth: request.dateOfBirth,
        lastKnownLocation: request.lastKnownLocation,
        photoUrl: request.photoUrl,
        status,
        caseId: id as string,
      });
    }

    // Real-time update
    getIO().emit(SocketEvents.REQUEST_UPDATED, {
      requestId: id,
      request: request.toObject(),
    });

    res.json(request);
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function discardRequest(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await MissingPersonRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    if (request.status !== "REPORTED") {
      res.status(400).json({
        error: "Can only discard requests with REPORTED status",
      });
      return;
    }

    request.status = "DISCARDED";
    await request.save();

    await CaseEvent.create({
      requestId: id,
      action: "DISCARDED",
      actor: req.user!.userId,
      details: "Request discarded",
    });

    // Real-time update
    getIO().emit(SocketEvents.REQUEST_UPDATED, {
      requestId: id,
      request: request.toObject(),
    });

    res.json(request);
  } catch (error) {
    console.error("Discard request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addPoliceNote(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { note } = req.body as AddPoliceNoteDTO;

    if (!note || note.trim().length === 0) {
      res.status(400).json({ error: "Note content is required" });
      return;
    }

    const request = await MissingPersonRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const policeNote = await PoliceNote.create({
      requestId: id,
      policeUserId: req.user!.userId,
      note: note.trim(),
    });

    const noteEvent = await CaseEvent.create({
      requestId: id,
      action: "NOTE_ADDED",
      actor: req.user!.userId,
      details: note.trim(),
    });

    // Real-time update
    getIO().emit(SocketEvents.NOTE_ADDED, {
      requestId: id,
      note: policeNote.toObject(),
      event: noteEvent.toObject(),
    });

    res.status(201).json(policeNote);
  } catch (error) {
    console.error("Add police note error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function triggerFaceScan(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await MissingPersonRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    if (request.status !== "UNDER_REVIEW") {
      res.status(400).json({
        error: "Scan can only be triggered when status is UNDER_REVIEW",
      });
      return;
    }

    // Move to SCANNING status
    request.status = "SCANNING";
    await request.save();

    await CaseEvent.create({
      requestId: id,
      action: "SCAN_TRIGGERED",
      actor: req.user!.userId,
      details: "Face recognition scan initiated",
    });

    // Call face recognition service
    const scanResults = await callFaceRecognitionAPI(
      request.photoUrl,
      id as string
    );

    // Save all scan results (one per CCTV camera)
    const savedResults = await ScanResult.insertMany(scanResults);

    const matchCount = scanResults.filter((r: any) => r.status === "found").length;
    await CaseEvent.create({
      requestId: id,
      action: "SCAN_COMPLETED",
      actor: req.user!.userId,
      details: `Scan completed — ${matchCount} match(es) across ${scanResults.length} cameras`,
    });

    // Real-time update — pushes scans so frontend doesn't need to poll
    getIO().emit(SocketEvents.SCAN_COMPLETED, {
      requestId: id,
      scans: savedResults.map((s: any) => s.toObject ? s.toObject() : s),
      request: request.toObject(),
    });

    res.status(201).json(savedResults);
  } catch (error: any) {
    console.error("Trigger face scan error:", error);
    // Surface face-recon specific errors
    if (error.message?.includes("No face detected")) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error.message?.includes("Face recognition service")) {
      res.status(502).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getScanResults(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await MissingPersonRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const scanResults = await ScanResult.find({ requestId: id }).sort({
      createdAt: -1,
    });

    res.json(scanResults);
  } catch (error) {
    console.error("Get scan results error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getRequestById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await MissingPersonRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const notes = await PoliceNote.find({ requestId: id }).sort({
      createdAt: -1,
    });
    const scans = await ScanResult.find({ requestId: id }).sort({
      createdAt: -1,
    });
    const tips = await Tip.find({ requestId: id }).sort({
      createdAt: -1,
    });
    const events = await CaseEvent.find({ requestId: id }).sort({
      createdAt: 1,
    });

    res.json({ request, notes, scans, tips, events });
  } catch (error) {
    console.error("Get request by id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function fetchAadhaarInfo(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await MissingPersonRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    if (!request.aadhaarNo) {
      res
        .status(400)
        .json({ error: "This report does not have an Aadhaar number" });
      return;
    }

    // Call mock-aadhaar service
    const aadhaarRes = await fetch(
      `${MOCK_AADHAAR_URL}/find?adhaarno=${request.aadhaarNo}`
    );

    if (!aadhaarRes.ok) {
      res
        .status(404)
        .json({ error: "Aadhaar record not found for this number" });
      return;
    }

    const aadhaarData = (await aadhaarRes.json()) as {
      aadhaar_card_no: string;
      name: string;
      dob: string;
      gender: string;
      phone_number: string;
      address: string;
    };

    // Populate report with Aadhaar data
    request.name = aadhaarData.name;
    request.gender = aadhaarData.gender;
    request.dateOfBirth = new Date(aadhaarData.dob);
    request.phoneNumber = aadhaarData.phone_number;
    request.address = aadhaarData.address;
    await request.save();

    await CaseEvent.create({
      requestId: id,
      action: "AADHAAR_FETCHED",
      actor: req.user!.userId,
      details: `Aadhaar info fetched for ${aadhaarData.name}`,
    });

    // Real-time update
    getIO().emit(SocketEvents.REQUEST_UPDATED, {
      requestId: id,
      request: request.toObject(),
    });

    res.json(request);
  } catch (error) {
    console.error("Fetch aadhaar info error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Duplicate Alert Endpoints ──────────────────────────

/** Get all pending duplicate alerts (for dashboard banner) */
export async function getDuplicateAlerts(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status && typeof status === "string") {
      filter.status = status;
    } else {
      filter.status = "PENDING";
    }

    const alerts = await DuplicateAlert.find(filter).sort({
      severity: 1,
      createdAt: -1,
    });

    // Populate both requests' summary info
    const populated = await Promise.all(
      alerts.map(async (alert) => {
        const [newReq, existingReq] = await Promise.all([
          MissingPersonRequest.findById(alert.newRequestId).select(
            "name photoUrl status gender bloodGroup createdAt"
          ),
          MissingPersonRequest.findById(alert.existingRequestId).select(
            "name photoUrl status gender bloodGroup createdAt"
          ),
        ]);
        return {
          ...alert.toObject(),
          newRequest: newReq?.toObject() || null,
          existingRequest: existingReq?.toObject() || null,
        };
      })
    );

    res.json(populated);
  } catch (error) {
    console.error("Get duplicate alerts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/** Get duplicate alerts for a specific request */
export async function getRequestDuplicates(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const alerts = await DuplicateAlert.find({
      $or: [{ newRequestId: id }, { existingRequestId: id }],
    }).sort({ severity: 1, createdAt: -1 });

    const populated = await Promise.all(
      alerts.map(async (alert) => {
        const [newReq, existingReq] = await Promise.all([
          MissingPersonRequest.findById(alert.newRequestId).select(
            "name photoUrl status gender bloodGroup createdAt"
          ),
          MissingPersonRequest.findById(alert.existingRequestId).select(
            "name photoUrl status gender bloodGroup createdAt"
          ),
        ]);
        return {
          ...alert.toObject(),
          newRequest: newReq?.toObject() || null,
          existingRequest: existingReq?.toObject() || null,
        };
      })
    );

    res.json(populated);
  } catch (error) {
    console.error("Get request duplicates error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/** Dismiss a duplicate alert */
export async function dismissDuplicateAlert(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const alert = await DuplicateAlert.findById(id);
    if (!alert) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    alert.status = "DISMISSED";
    await alert.save();

    await CaseEvent.create({
      requestId: alert.newRequestId,
      action: "DUPLICATE_DETECTED",
      actor: req.user!.userId,
      details: `Duplicate alert dismissed (was linked to case ${alert.existingRequestId})`,
    });

    res.json(alert);
  } catch (error) {
    console.error("Dismiss duplicate alert error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/** Link two duplicate cases */
export async function linkDuplicateCases(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const alert = await DuplicateAlert.findById(id);
    if (!alert) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    alert.status = "LINKED";
    await alert.save();

    const pct = Math.round(alert.score * 100);

    // Add cross-reference notes on both cases
    await PoliceNote.create({
      requestId: alert.newRequestId,
      policeUserId: req.user!.userId,
      note: `🔗 Linked as duplicate of case ${alert.existingRequestId} (${pct}% ${alert.matchType} match)`,
    });
    await PoliceNote.create({
      requestId: alert.existingRequestId,
      policeUserId: req.user!.userId,
      note: `🔗 Linked as duplicate of case ${alert.newRequestId} (${pct}% ${alert.matchType} match)`,
    });

    // Log events
    await CaseEvent.create({
      requestId: alert.newRequestId,
      action: "DUPLICATE_DETECTED",
      actor: req.user!.userId,
      details: `Cases linked as duplicates (${pct}% ${alert.matchType} match)`,
    });
    await CaseEvent.create({
      requestId: alert.existingRequestId,
      action: "DUPLICATE_DETECTED",
      actor: req.user!.userId,
      details: `Cases linked as duplicates (${pct}% ${alert.matchType} match)`,
    });

    res.json(alert);
  } catch (error) {
    console.error("Link duplicate cases error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
