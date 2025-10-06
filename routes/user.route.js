import express from "express";
import { createOrFetchUser, getUser } from "../controllers/user.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/createOrFetchUser", verifyFirebaseToken, createOrFetchUser);
router.get("/me", verifyFirebaseToken, getUser);

export default router;