import { Router } from "express";
import {
  getBounty,
  initiateBountyPayment,
  verifyBountyPayment,
  awardBounty,
  releaseBounty,
  cancelBounty,
} from "../controllers/bountyController.ts";
import { authenticate, requireRole } from "../middlewares/auth.ts";

const router = Router();

// Public-ish: anyone authenticated can view bounty info (tip page shows bounty)
router.get("/:requestId", authenticate, getBounty);

// Citizen (reporter) endpoints
router.post("/:requestId/pay", authenticate, initiateBountyPayment);
router.get("/:requestId/verify", authenticate, verifyBountyPayment);
router.patch("/:requestId/cancel", authenticate, cancelBounty);

// Police-only endpoints
router.patch(
  "/:requestId/award",
  authenticate,
  requireRole("POLICE"),
  awardBounty
);
router.patch(
  "/:requestId/release",
  authenticate,
  requireRole("POLICE"),
  releaseBounty
);

export default router;
