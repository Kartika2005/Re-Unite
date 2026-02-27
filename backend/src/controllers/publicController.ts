import type { Request, Response } from "express";
import { MissingPersonRequest } from "../models/MissingPersonRequest.ts";
import { Tip } from "../models/Tip.ts";
import { CaseEvent } from "../models/CaseEvent.ts";
import { getIO, SocketEvents } from "../socket.ts";
import {
  transcribeAudio,
  parseManualFormFields,
  parseAadhaarFormFields,
} from "../services/groqService.ts";
import type { SubmitTipDTO } from "../types/index.ts";

export async function getPublicCases(req: Request, res: Response) {
  try {
    const cases = await MissingPersonRequest.find(
      { status: { $ne: "DISCARDED" } },
      {
        lastKnownLocation: 1,
        status: 1,
        name: 1,
        gender: 1,
        bloodGroup: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    res.json(cases);
  } catch (error) {
    console.error("getPublicCases error:", error);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
}

export async function getPublicCaseById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const caseData = await MissingPersonRequest.findById(id, {
      name: 1,
      gender: 1,
      bloodGroup: 1,
      photoUrl: 1,
      lastKnownLocation: 1,
      status: 1,
      bountyAmount: 1,
      createdAt: 1,
    }).lean();

    if (!caseData) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    if (["FOUND", "DECLINED", "DISCARDED"].includes(caseData.status)) {
      res.json({ case: caseData, resolved: true, tipCount: 0, bountyAmount: (caseData as any).bountyAmount || 0 });
      return;
    }

    const tipCount = await Tip.countDocuments({ requestId: id });
    res.json({ case: caseData, resolved: false, tipCount, bountyAmount: (caseData as any).bountyAmount || 0 });
  } catch (error) {
    console.error("getPublicCaseById error:", error);
    res.status(500).json({ error: "Failed to fetch case" });
  }
}

export async function submitTip(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { message, location, contactInfo } = req.body as SubmitTipDTO;

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const caseData = await MissingPersonRequest.findById(id);
    if (!caseData) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    if (["FOUND", "DECLINED", "DISCARDED"].includes(caseData.status)) {
      res.status(400).json({ error: "This case is no longer accepting tips" });
      return;
    }

    const tip = await Tip.create({
      requestId: id,
      message: message.trim(),
      location: location || undefined,
      contactInfo: contactInfo?.trim() || undefined,
    });

    const tipEvent = await CaseEvent.create({
      requestId: id,
      action: "TIP_RECEIVED",
      details: "Anonymous tip submitted" + (location ? " with location" : ""),
    });

    // Real-time update
    getIO().emit(SocketEvents.TIP_RECEIVED, {
      requestId: id,
      tip: tip.toObject(),
      event: tipEvent.toObject(),
    });

    res.status(201).json(tip);
  } catch (error) {
    console.error("submitTip error:", error);
    res.status(500).json({ error: "Failed to submit tip" });
  }
}

/**
 * POST /api/public/voice-to-form
 * Accepts audio file + mode ("manual"|"aadhaar"), returns parsed form fields.
 */
export async function voiceToForm(req: Request, res: Response) {
  try {
    const mode = (req.body?.mode as string) || "manual";

    if (!req.file) {
      res.status(400).json({ error: "Audio file is required" });
      return;
    }

    // 1. Transcribe audio
    const transcript = await transcribeAudio(
      req.file.buffer,
      req.file.mimetype
    );

    // 2. Parse into form fields based on mode
    if (mode === "aadhaar") {
      const fields = await parseAadhaarFormFields(transcript);
      res.json({ transcript, fields });
    } else {
      const fields = await parseManualFormFields(transcript);
      res.json({ transcript, fields });
    }
  } catch (error) {
    console.error("voiceToForm error:", error);
    res.status(500).json({ error: "Failed to process voice input" });
  }
}
