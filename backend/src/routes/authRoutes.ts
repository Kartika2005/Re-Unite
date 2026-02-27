import { Router } from "express";
import { register, login, getMe } from "../controllers/authController.ts";
import { authenticate } from "../middlewares/auth.ts";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getMe);

export default router;
