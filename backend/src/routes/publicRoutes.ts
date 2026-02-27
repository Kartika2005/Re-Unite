import { Router } from "express";
import multer from "multer";
import {
  getPublicCases,
  getPublicCaseById,
  submitTip,
  voiceToForm,
} from "../controllers/publicController.ts";

const router = Router();

// Audio upload middleware (25 MB, audio files only)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("audio/") ||
      file.mimetype === "video/webm" // browser MediaRecorder often uses video/webm for audio
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

router.get("/cases", getPublicCases);
router.get("/cases/:id", getPublicCaseById);
router.post("/cases/:id/tip", submitTip);
router.post("/voice-to-form", audioUpload.single("audio"), voiceToForm);

export default router;
