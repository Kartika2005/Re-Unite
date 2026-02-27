import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.ts";
import {
  BountyTransaction,
  type BountyStatus,
} from "../models/BountyTransaction.ts";
import { MissingPersonRequest } from "../models/MissingPersonRequest.ts";
import { Tip } from "../models/Tip.ts";
import { CaseEvent } from "../models/CaseEvent.ts";
import { getIO, SocketEvents } from "../socket.ts";
import {
  initiatePayment,
  checkPaymentStatus,
} from "../services/phonepeService.ts";

// ──────────────────────────────────────────────────
// 1. GET  /api/bounty/:requestId
//    Get bounty info for a case (public-ish — no auth required for tip page)
// ──────────────────────────────────────────────────
export async function getBounty(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;
    const bounty = await BountyTransaction.findOne({ requestId });
    if (!bounty) {
      res.json(null);
      return;
    }
    // Strip sensitive fields for non-police
    const obj = bounty.toObject();
    if (req.user?.role !== "POLICE") {
      delete (obj as any).merchantOrderId;
      delete (obj as any).phonepeOrderId;
      delete (obj as any).transactionId;
    }
    res.json(obj);
  } catch (error) {
    console.error("getBounty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────────
// 2. POST /api/bounty/:requestId/pay
//    Reporter initiates PhonePe payment for the pledged bounty
// ──────────────────────────────────────────────────
export async function initiateBountyPayment(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;

    const bounty = await BountyTransaction.findOne({ requestId });
    if (!bounty) {
      res.status(404).json({ error: "No bounty exists for this case" });
      return;
    }

    // Only the reporter who pledged can pay
    if (bounty.reporterId !== req.user!.userId) {
      res.status(403).json({ error: "Only the reporter can pay the bounty" });
      return;
    }

    // Must be in PLEDGED, PAYMENT_PENDING, or PAYMENT_FAILED state
    if (!["PLEDGED", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(bounty.status)) {
      res.status(400).json({
        error: `Cannot initiate payment — bounty is ${bounty.status}`,
      });
      return;
    }

    // Generate unique merchant order ID
    const reqId = requestId as string;
    const merchantOrderId = `BOUNTY_${reqId.slice(-8)}_${Date.now()}`;

    // Initiate PhonePe payment
    const { redirectUrl } = await initiatePayment(
      merchantOrderId,
      bounty.amount
    );

    // Update bounty record
    bounty.status = "PAYMENT_INITIATED";
    bounty.merchantOrderId = merchantOrderId;
    await bounty.save();

    res.json({ redirectUrl, merchantOrderId });
  } catch (error) {
    console.error("initiateBountyPayment error:", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
}

// ──────────────────────────────────────────────────
// 3. GET /api/bounty/:requestId/verify
//    Verify payment status after PhonePe redirect
// ──────────────────────────────────────────────────
export async function verifyBountyPayment(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;
    const { orderId } = req.query;

    const bounty = await BountyTransaction.findOne({ requestId });
    if (!bounty) {
      res.status(404).json({ error: "No bounty exists for this case" });
      return;
    }

    // Use the orderId from query or the one stored on the bounty
    const merchantOrderId =
      (orderId as string) || bounty.merchantOrderId;

    if (!merchantOrderId) {
      res.status(400).json({ error: "No payment to verify" });
      return;
    }

    const status = await checkPaymentStatus(merchantOrderId);

    if (status.state === "COMPLETED") {
      bounty.status = "PAYMENT_COMPLETED";
      bounty.phonepeOrderId = status.orderId;
      bounty.transactionId = status.transactionId;
      bounty.paidAt = new Date();
      await bounty.save();

      await CaseEvent.create({
        requestId,
        action: "BOUNTY_PAID",
        actor: bounty.reporterId,
        details: `Bounty of ₹${bounty.amount} paid via PhonePe (Txn: ${status.transactionId || merchantOrderId})`,
      });

      getIO().emit(SocketEvents.REQUEST_UPDATED, {
        requestId,
        bountyStatus: "PAYMENT_COMPLETED",
      });

      res.json({
        success: true,
        state: "COMPLETED",
        amount: bounty.amount,
        transactionId: status.transactionId,
      });
    } else if (status.state === "FAILED") {
      bounty.status = "PAYMENT_FAILED";
      await bounty.save();

      res.json({ success: false, state: "FAILED" });
    } else {
      // PENDING
      res.json({ success: false, state: status.state });
    }
  } catch (error) {
    console.error("verifyBountyPayment error:", error);
    res.status(500).json({ error: "Failed to verify payment" });
  }
}

// ──────────────────────────────────────────────────
// 4. PATCH /api/bounty/:requestId/award
//    Police awards bounty to a specific tip (sets awardedTipId)
// ──────────────────────────────────────────────────
export async function awardBounty(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;
    const { tipId } = req.body;

    if (!tipId) {
      res.status(400).json({ error: "tipId is required" });
      return;
    }

    const bounty = await BountyTransaction.findOne({ requestId });
    if (!bounty) {
      res.status(404).json({ error: "No bounty exists for this case" });
      return;
    }

    // Verify the tip belongs to this case
    const tip = await Tip.findOne({ _id: tipId, requestId });
    if (!tip) {
      res.status(404).json({ error: "Tip not found for this case" });
      return;
    }

    bounty.awardedTipId = tipId;
    bounty.awardedTipperContact = tip.contactInfo || undefined;
    bounty.status = "PAYMENT_PENDING";
    await bounty.save();

    await CaseEvent.create({
      requestId,
      action: "BOUNTY_AWARDED",
      actor: req.user!.userId,
      details: `Bounty of ₹${bounty.amount} awarded to tipper${tip.contactInfo ? ` (${tip.contactInfo})` : " (anonymous)"}`,
    });

    getIO().emit(SocketEvents.REQUEST_UPDATED, {
      requestId,
      bountyStatus: "PAYMENT_PENDING",
    });

    res.json(bounty);
  } catch (error) {
    console.error("awardBounty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────────
// 5. PATCH /api/bounty/:requestId/release
//    Police marks bounty as released to tipper (after handing cash)
// ──────────────────────────────────────────────────
export async function releaseBounty(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;

    const bounty = await BountyTransaction.findOne({ requestId });
    if (!bounty) {
      res.status(404).json({ error: "No bounty exists for this case" });
      return;
    }

    if (bounty.status !== "PAYMENT_COMPLETED") {
      res.status(400).json({
        error: "Bounty must be paid before it can be released",
      });
      return;
    }

    bounty.status = "RELEASED_TO_TIPPER";
    await bounty.save();

    await CaseEvent.create({
      requestId,
      action: "BOUNTY_RELEASED",
      actor: req.user!.userId,
      details: `Bounty of ₹${bounty.amount} released to tipper${bounty.awardedTipperContact ? ` (${bounty.awardedTipperContact})` : ""}`,
    });

    getIO().emit(SocketEvents.REQUEST_UPDATED, {
      requestId,
      bountyStatus: "RELEASED_TO_TIPPER",
    });

    res.json(bounty);
  } catch (error) {
    console.error("releaseBounty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────────
// 6. PATCH /api/bounty/:requestId/cancel
//    Reporter cancels bounty (only if PLEDGED — not yet paid)
// ──────────────────────────────────────────────────
export async function cancelBounty(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;

    const bounty = await BountyTransaction.findOne({ requestId });
    if (!bounty) {
      res.status(404).json({ error: "No bounty exists for this case" });
      return;
    }

    // Only reporter can cancel
    if (bounty.reporterId !== req.user!.userId) {
      res.status(403).json({ error: "Only the reporter can cancel the bounty" });
      return;
    }

    if (bounty.status !== "PLEDGED") {
      res.status(400).json({
        error: "Can only cancel a pledged bounty that hasn't been paid",
      });
      return;
    }

    bounty.status = "CANCELLED";
    await bounty.save();

    // Also clear on the request
    await MissingPersonRequest.updateOne(
      { _id: requestId },
      { bountyAmount: 0, bountyStatus: "CANCELLED" }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("cancelBounty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
