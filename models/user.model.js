// models/User.js
import e from "express";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    profileSetup: {
      type: Boolean,
      default: false,
    },
    profile: {
      fullName: String,
      role: String,
      company: String,
      joinDate: String,
      bio: String,
      linkedin: String,
      github: String,
      website: String,
      skills: [String],
      experience: [{
        company: String,
        role: String,
        duration: String,
        description: String,
        current: Boolean
      }],
      resumeText: String,
      parsedData: {
        skills: [String],
        experience: String,
        education: String,
        summary: String
      },
      coverImage: String,
      avatar: String
    },
    stats: {
      interviews: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
      certificates: { type: Number, default: 0 },
      projects: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);