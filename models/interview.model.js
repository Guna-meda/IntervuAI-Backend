// models/interview.model.js
import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String },
  feedback: { type: String },
  score: { type: Number, default: 0 },
  questionType: { 
    type: String, 
    enum: ["prepared", "followup"],
    required: true 
  },
  parentQuestionIndex: { type: Number }, // for follow-up questions, index of parent prepared question
  askedAt: { type: Date, default: Date.now },
  answeredAt: { type: Date }
}, { _id: false });

const roundSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true },
  status: {
    type: String,
    enum: ["not_started", "in_progress", "completed"],
    default: "not_started"
  },
  questions: [questionSchema],
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { _id: false });

const interviewSchema = new mongoose.Schema({
  interviewId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  role: { type: String, required: true },
  totalRounds: { type: Number, default: 3 },
  currentRound: { type: Number, default: 1 },
  rounds: [roundSchema],
  progress: { type: Number, default: 0 },
  overallFeedback: { type: String },
  overallSummary: { type: String },
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active"
  },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

// Generate unique interview ID before saving
interviewSchema.pre('save', function(next) {
  if (!this.interviewId) {
    this.interviewId = `IVW_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

export const Interview = mongoose.model("Interview", interviewSchema);