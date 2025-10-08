import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String },
  feedback: { type: String }, // optional (AI feedback)
  score: { type: Number, default: 0 } // optional for analytics later
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
  completedAt: { type: Date }
}, { _id: false });

const interviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  role: { type: String, required: true }, // e.g., Frontend Developer
  totalRounds: { type: Number, default: 3 },
  currentRound: { type: Number, default: 1 },
  rounds: [roundSchema],
  progress: { type: Number, default: 0 }, // percentage completed
  overallFeedback: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now }
});

export const Interview = mongoose.model("Interview", interviewSchema);
