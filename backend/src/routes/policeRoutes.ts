import { Router } from "express";
import {
  getAllRequests,
  getRequestById,
  updateRequestStatus,
  discardRequest,
  addPoliceNote,
  triggerFaceScan,
  getScanResults,
  fetchAadhaarInfo,
  getDuplicateAlerts,
  getRequestDuplicates,
  dismissDuplicateAlert,
  linkDuplicateCases,
} from "../controllers/policeController.ts";
import { authenticate, requireRole } from "../middlewares/auth.ts";

const router = Router();

router.use(authenticate, requireRole("POLICE"));

router.get("/alerts/duplicates", getDuplicateAlerts);
router.patch("/alerts/duplicates/:id/dismiss", dismissDuplicateAlert);
router.patch("/alerts/duplicates/:id/link", linkDuplicateCases);

router.get("/requests", getAllRequests);
router.get("/requests/:id", getRequestById);
router.get("/requests/:id/duplicates", getRequestDuplicates);
router.patch("/requests/:id/status", updateRequestStatus);
router.patch("/requests/:id/discard", discardRequest);
router.post("/requests/:id/scan", triggerFaceScan);
router.post("/requests/:id/note", addPoliceNote);
router.get("/requests/:id/scans", getScanResults);
router.post("/requests/:id/fetch-aadhaar", fetchAadhaarInfo);

export default router;
