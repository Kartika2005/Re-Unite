import { Router } from "express";
import {
  createMissingPersonRequest,
  getMyRequests,
  activateRfidCapture,
  captureRfidTag,
  ingestDeviceRfidTap,
  getLatestDeviceRfidTap,
  createAssociatedFamilyMember,
  getAssociatedFamilyMembers,
} from "../controllers/citizenController.ts";
import { authenticate, requireRole } from "../middlewares/auth.ts";
import upload from "../middlewares/upload.ts";

const router = Router();

// Public RFID flow for hardware taps (still session-gated by activation)
router.post("/family-members/rfid/activate", activateRfidCapture);
router.post("/family-members/rfid/capture", captureRfidTag);
router.post("/family-members/rfid/device-tap", ingestDeviceRfidTap);
router.get("/family-members/rfid/latest/:citizenId", getLatestDeviceRfidTap);

router.use(authenticate, requireRole("CITIZEN"));

router.post("/", upload.single("photo"), createMissingPersonRequest);
router.get("/me", getMyRequests);
router.post("/family-members", createAssociatedFamilyMember);
router.get("/family-members", getAssociatedFamilyMembers);

export default router;
