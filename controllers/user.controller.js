// user.controller.js
import { User } from "../models/user.model.js";
import mongoose from "mongoose";
import { parseResume } from "../utils/parseResume.js";

export const createOrFetchUser = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB is not connected");
    }

    const { uid, email, displayName } = req.body;
    const firebaseUid = req.firebaseUid;

    if (!uid || !email) {
      return res.status(400).json({ error: "Missing required fields: uid and email" });
    }

    if (uid !== firebaseUid) {
      return res.status(403).json({ error: "Unauthorized: UID mismatch" });
    }

    const finalDisplayName = displayName || email.split("@")[0] || "User";

    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email,
        displayName: finalDisplayName,
        profileSetup: false
      });
    } else {
      if (user.displayName !== finalDisplayName) {
        user.displayName = finalDisplayName;
        await user.save();
      }
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error in createOrFetchUser:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const setupProfile = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const profileData = req.body;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

      let parsedData;
    if (profileData.resumeText !== undefined && profileData.resumeText) {
      parsedData = await parseResume(profileData.resumeText);
    }


    // Update profile and mark as setup
    user.profile = {
      fullName: profileData.fullName,
      role: profileData.role,
      company: profileData.company,
      joinDate: profileData.joinDate,
      bio: profileData.bio,
      linkedin: profileData.linkedin,
      github: profileData.github,
      website: profileData.website,
      skills: profileData.skills,
      resumeText: profileData.resumeText,
      parsedData: parsedData
    };
    
    user.profileSetup = true;
    await user.save();

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error in setupProfile:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const getUser = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error in getUser:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const updateData = req.body;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    // Update profile fields if provided
    let parsedData;
    if (updateData.resumeText !== undefined && updateData.resumeText) {
      parsedData = await parseResume(updateData.resumeText);
    }

    // Update profile fields if provided
    if (updateData.resumeText !== undefined) {
      user.profile.resumeText = updateData.resumeText;
    }

    if (updateData.parsedData !== undefined) {
      // if parsedData was computed above prefer that, otherwise use provided parsedData
      user.profile.parsedData = parsedData || updateData.parsedData;
    }
    
    // Update other profile fields if provided
    if (updateData.fullName !== undefined) {
      user.profile.fullName = updateData.fullName;
    }
    if (updateData.role !== undefined) {
      user.profile.role = updateData.role;
    }
    if (updateData.company !== undefined) {
      user.profile.company = updateData.company;
    }
    if (updateData.bio !== undefined) {
      user.profile.bio = updateData.bio;
    }
    if (updateData.skills !== undefined) {
      user.profile.skills = updateData.skills;
    }
    if (updateData.linkedin !== undefined) {
      user.profile.linkedin = updateData.linkedin;
    }
    if (updateData.github !== undefined) {
      user.profile.github = updateData.github;
    }
    if (updateData.website !== undefined) {
      user.profile.website = updateData.website;
    }

    await user.save();
    return res.status(200).json(user);
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Calculate stats from user's interview data
    const stats = {
      totalInterviews: user.interviews?.length || 0,
      averageScore: calculateAverageScore(user.interviews),
      completionRate: calculateCompletionRate(user.interviews),
      currentStreak: calculateCurrentStreak(user.interviews),
      technicalScore: 75 + Math.floor(Math.random() * 20), // Example calculation
      communicationScore: 70 + Math.floor(Math.random() * 25),
      problemSolvingScore: 80 + Math.floor(Math.random() * 15),
      confidenceScore: 75 + Math.floor(Math.random() * 20),
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error in getUserStats:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

// Helper functions
const calculateAverageScore = (interviews) => {
  if (!interviews || interviews.length === 0) return 0;
  const total = interviews.reduce((sum, interview) => sum + (interview.overallScore || 0), 0);
  return Math.round((total / interviews.length) * 10) / 10;
};

const calculateCompletionRate = (interviews) => {
  if (!interviews || interviews.length === 0) return 0;
  const completed = interviews.filter(interview => interview.status === 'completed').length;
  return Math.round((completed / interviews.length) * 100);
};

const calculateCurrentStreak = (interviews) => {
  // Implementation for calculating current streak
  return Math.floor(Math.random() * 30) + 1; // Example
};