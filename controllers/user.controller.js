// user.controller.js
import { User } from "../models/user.model.js";
import mongoose from "mongoose";
import { parseResume } from "../utils/parseResume.js";
import { uploadToCloudinary } from '../utils/cloudinary.js';


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

    let parsedData;
    
    // Update resume text and parse if provided
    if (updateData.resumeText !== undefined) {
      user.profile.resumeText = updateData.resumeText;
      
      // Parse resume if text is provided and not empty
      if (updateData.resumeText && updateData.resumeText.trim()) {
        try {
          parsedData = await parseResume(updateData.resumeText);
        } catch (parseError) {
          console.error("Error parsing resume:", parseError);
          // Continue without parsed data if parsing fails
        }
      }
    }

    // Update parsed data - prefer newly parsed data over provided parsedData
    if (parsedData) {
      user.profile.parsedData = parsedData;
    } else if (updateData.parsedData !== undefined) {
      user.profile.parsedData = updateData.parsedData;
    }

    // Update other profile fields if provided
    const profileFields = [
      'fullName', 'role', 'company', 'bio', 'skills', 
      'linkedin', 'github', 'website', 'joinDate'
    ];

    profileFields.forEach(field => {
      if (updateData[field] !== undefined) {
        user.profile[field] = updateData[field];
      }
    });

    // Update experience if provided
    if (updateData.experience !== undefined) {
      user.profile.experience = updateData.experience;
    }

    // Handle file uploads
    if (req.files) {
      if (req.files.avatar) {
        const avatarResult = await uploadToCloudinary(req.files.avatar[0].buffer, 'avatars');
        user.profile.avatar = {
          url: avatarResult.secure_url,
          fileName: avatarResult.public_id,
          uploadedAt: new Date()
        };
      }

      if (req.files.coverImage) {
        const coverResult = await uploadToCloudinary(req.files.coverImage[0].buffer, 'covers');
        user.profile.coverImage = {
          url: coverResult.secure_url,
          fileName: coverResult.public_id,
          uploadedAt: new Date()
        };
      }
    }

    // Save the updated user
    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      data: user
    });

  } catch (error) {
    console.error("Error in updateProfile:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};
export const uploadImages = async (req, res) => {
  try {
    const { firebaseUid } = req.user;
    const { type } = req.body; // 'avatar' or 'cover'

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const folder = type === 'avatar' ? 'avatars' : 'covers';
    const result = await uploadToCloudinary(req.file.buffer, folder);

    const imageData = {
      url: result.secure_url,
      fileName: result.public_id,
      uploadedAt: new Date()
    };

    if (type === 'avatar') {
      user.profile.avatar = imageData;
    } else {
      user.profile.coverImage = imageData;
    }

    await user.save();

    res.json({
      message: `${type} uploaded successfully`,
      data: imageData
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Internal server error' });
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