// routes/llm.routes.js
import express from "express";
import {
  generatePreparedQuestion,
  generateFollowUpQuestion,
  generateOverallInterviewSummary,
  generateAnswerFeedback
} from "../controllers/llm.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyFirebaseToken);

// Generate new prepared question
router.post("/generate-prepared-question", generatePreparedQuestion);

// Generate follow-up question based on response
router.post("/generate-followup-question", generateFollowUpQuestion);

// Generate summary for entire interview
router.post("/generate-overall-summary", generateOverallInterviewSummary);

// generate feedback for a given answer
router.post("/generate-feedback" , generateAnswerFeedback);

export default router;