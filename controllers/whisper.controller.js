import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import WhisperService from "../services/whisperService.js";

class WhisperController {
  /**
   * Handle file upload and transcription
   */
  transcribeAudio = asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No audio file uploaded" });
    }

    const audioBuffer = req.file.buffer;

    const transcript = await WhisperService.transcribeAudio(audioBuffer, req.file.originalname);

    return res.status(200).json(new ApiResponse(200, { transcript }, "Transcription successful"));
  });
}

export default new WhisperController();
