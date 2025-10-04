import express from "express";
import multer from "multer";
import { TranscribeAudio } from "../controllers/speech.controller.js";

const router = express.Router();

// setup multer (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/v1/speech/transcribe
router.post("/transcribe", upload.single("audio"), TranscribeAudio);

export default router;
