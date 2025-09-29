import express from "express";
import upload from "../middlewares/multer.middleware.js";
import WhisperController from "../controllers/whisper.controller.js";

const router = express.Router();

router.post("/transcribe", upload.single("file"), WhisperController.transcribeAudio);

export default router;
