// routes/interview.route.js
import express from "express";
import {
  startInterview,
  getActiveInterview, // Make sure this is imported
  getAllInterviews,
  completeRound,
  startRound,
  cancelInterview,
  getInterviewStats,
  getInterviewDetails
} from "../controllers/interview.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyFirebaseToken);

// Start a new interview
router.post("/start", startInterview);

// Get all interviews for the user (with optional status filter)
router.get("/", getAllInterviews);

// Get interview statistics
router.get("/stats", getInterviewStats);

// Get specific interview details - this should handle getActiveInterview
router.get("/:interviewId", getInterviewDetails); // This serves both getActiveInterview and getInterviewDetails

// Start a specific round
router.post("/:interviewId/start-round/:roundNumber", startRound);

// Complete a round and submit all questions/answers/feedback
router.post("/:interviewId/complete-round", completeRound);

// Cancel an interview
router.post("/:interviewId/cancel", cancelInterview);

export default router;