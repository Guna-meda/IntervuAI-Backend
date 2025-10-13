import express from "express";
import { getAnalytics } from "../controllers/analytics.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyFirebaseToken, getAnalytics);


export default router;