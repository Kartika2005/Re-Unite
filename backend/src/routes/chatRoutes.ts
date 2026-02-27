import { Router } from "express";
import { chat, chatStatistics } from "../controllers/chatController.ts";
import { authenticate } from "../middlewares/auth.ts";

const router = Router();

router.use(authenticate);

router.post("/", chat);
router.get("/stats", chatStatistics);

export default router;
