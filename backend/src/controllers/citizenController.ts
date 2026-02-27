import type { Response } from "express";
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
  res: Response
): Promise<void> {
  try {
    const { name, gender, dateOfBirth, bloodGroup, lastKnownLocation, aadhaarNo, bountyAmount } =
      req.body;

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
          { faceEmbedding: embedding }
        );
        console.log(`🧬 Embedding saved for case ${request._id}`);

        await checkForDuplicates({
          _id: request._id.toString(),
          photoUrl,
          aadhaarNo: isAadhaarReport ? requestData.aadhaarNo as string : undefined,
          name: requestData.name as string | undefined,
          faceEmbedding: embedding,
        });
      } catch (err) {
        console.error("Duplicate check failed (non-blocking):", err);
      }
    })();
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMyRequests(
  req: AuthRequest,
  res: Response
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
