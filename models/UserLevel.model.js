// models/UserLevel.model.js
import mongoose from 'mongoose';

const userLevelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentLevel: {
    type: Number,
    default: 1
  },
  totalInterviews: {
    type: Number,
    default: 0
  },
  completedInterviews: {
    type: Number,
    default: 0
  },
  badges: [{
    badgeId: String,
    name: String,
    description: String,
    earnedAt: Date,
    icon: String
  }],
  readinessScore: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export const UserLevel = mongoose.model('UserLevel', userLevelSchema);