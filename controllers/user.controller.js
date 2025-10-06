import { User } from "../models/user.model.js";

export const createOrFetchUser = async (req, res) => {
  try {
    const { uid, email, displayName } = req.body;
    const firebaseUid = req.firebaseUid; // Set by verifyFirebaseToken middleware

    if (!uid || !email) {
      return res.status(400).json({ error: "Missing required fields: uid and email" });
    }

    if (uid !== firebaseUid) {
      return res.status(403).json({ error: "Unauthorized: UID mismatch" });
    }

    // Use email prefix as displayName if not provided
    const finalDisplayName = displayName || email.split("@")[0] || "User";

    // Find or create user in MongoDB
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email,
        displayName: finalDisplayName,
      });
      console.log("Created new MongoDB user:", user.email, "with displayName:", user.displayName);
    } else {
      // Optionally update displayName if it has changed
      if (user.displayName !== finalDisplayName) {
        user.displayName = finalDisplayName;
        await user.save();
        console.log("Updated MongoDB user displayName:", user.email, "to:", user.displayName);
      } else {
        console.log("Fetched existing MongoDB user:", user.email, "with displayName:", user.displayName);
      }
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error in createOrFetchUser:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getUser = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid; // Set by verifyFirebaseToken middleware
    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error in getUser:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};