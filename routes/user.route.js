import express from "express";
import { createOrFetchUser, getUser, setupProfile, updateProfile } from "../controllers/user.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/createOrFetchUser", verifyFirebaseToken, createOrFetchUser);
router.get("/me", verifyFirebaseToken, getUser);
router.post("/setup-profile", verifyFirebaseToken, setupProfile);
router.patch("/update-profile", verifyFirebaseToken, updateProfile);

export default router;