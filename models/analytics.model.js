import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  metrics: {
    sessionCount: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    totalPracticeTime: { type: Number, default: 0 }, // in minutes
    questionsAttempted: { type: Number, default: 0 },
    improvementRate: { type: Number, default: 0 }, // percentage
    streak: { type: Number, default: 0 }
  },
  skillBreakdown: [{
    skill: String,
    score: Number,
    questions: Number
  }],
  weeklyProgress: [{
    week: String,
    score: Number,
    sessions: Number
  }],
  performanceTrends: {
    technical: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 }
  }
}, { timestamps: true });

export const Analytics = mongoose.model("Analytics", analyticsSchema);