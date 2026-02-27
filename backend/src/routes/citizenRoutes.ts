import { Router } from "express";
import {
  createMissingPersonRequest,
  getMyRequests,
} from "../controllers/citizenController.ts";
import { authenticate, requireRole } from "../middlewares/auth.ts";
import upload from "../middlewares/upload.ts";

const router = Router();

router.use(authenticate, requireRole("CITIZEN"));

router.post("/", upload.single("photo"), createMissingPersonRequest);
router.get("/me", getMyRequests);

export default router;
