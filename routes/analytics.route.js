import express from "express";
import { 
  getAnalytics,
  calculateRealSkillBreakdown,
  calculateRealWeeklyProgress,
  calculateRealPerformanceTrends,
  calculateImprovementRate,
  calculateCurrentStreak,
  calculateInterviewScore,
  calculateInterviewDuration
} from "../controllers/analytics.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyFirebaseToken);

// Main analytics route
router.get("/", getAnalytics);

// Individual analytics components
router.get("/skills", calculateRealSkillBreakdown);
router.get("/weekly-progress", calculateRealWeeklyProgress);
router.get("/performance-trends", calculateRealPerformanceTrends);
router.get("/improvement-rate", calculateImprovementRate);
router.get("/current-streak", calculateCurrentStreak);

// Interview-specific analytics
router.get("/interview/:interviewId/score", calculateInterviewScore);
router.get("/interview/:interviewId/duration", calculateInterviewDuration);

// You might want to keep this POST route if you need it for specific calculations
router.post("/skills", calculateRealSkillBreakdown);

export default router;