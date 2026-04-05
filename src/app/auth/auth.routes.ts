// src/app/modules/auth/auth.routes.ts
import { Router } from "express";
import * as authController from "./auth.controller";
import {
  signupSchema,
  signinSchema,
  forgotPasswordSchema,
  changePasswordSchema,
} from "./auth.validation";
import { authenticate } from "../middlewares/authenticate";
import { validate } from "../middlewares/validate";

const router = Router();

// ── Public ─────────────────────────────────────────────────────────────────
router.post("/signup", validate(signupSchema), authController.signup);
router.get("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendEmailVerification);
router.post("/signin", validate(signinSchema), authController.signin);
router.post("/refresh-token", authController.refreshToken);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.requestPasswordReset);
router.post("/verify-reset-code", authController.verifyResetCode);
router.post("/reset-password", authController.resetPasswordController);

// ── Protected ───────────────────────────────────────────────────────────────
router.use(authenticate);
router.get("/me", authController.getMe);
router.post("/logout", authController.logout);
router.post("/change-password", validate(changePasswordSchema), authController.changePasswordController);

export const authRoute = router;