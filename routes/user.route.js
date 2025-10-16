// routes/user.route.js
import express from "express";
import { 
  createOrFetchUser, 
  getUser, 
  getUserStats, 
  setupProfile, 
  updateProfile,
  uploadImages 
} from "../controllers/user.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/imageUpload.middleware.js";

const router = express.Router();

router.post("/createOrFetchUser", verifyFirebaseToken, createOrFetchUser);
router.get("/me", verifyFirebaseToken, getUser);
router.post("/setup-profile", verifyFirebaseToken, setupProfile);
router.patch(
  "/update-profile", 
  verifyFirebaseToken, 
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
  ]),
  updateProfile
);
router.get("/stats", verifyFirebaseToken, getUserStats);

// Single image upload route (keep if you still need it)
router.post(
  "/upload-image", 
  verifyFirebaseToken, 
  upload.single('image'),
  uploadImages
);

export default router;