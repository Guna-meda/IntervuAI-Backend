import { SpeechClient } from "@google-cloud/speech";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

// Initialize Google Speech Client
const client = new SpeechClient({
  keyFilename: "service-account-key.json", 
});

export const TranscribeAudio = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No audio file uploaded");
  }

  try {
    console.log('TranscribeAudio: received file', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    // Convert buffer to base64 for Google Speech API
    const audioBytes = req.file.buffer.toString("base64");

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        model: "default", // Add this for better accuracy
      },
    };

    console.log('TranscribeAudio: Sending request to Google Speech API...');
    
    const [response] = await client.recognize(request);
    
    // Detailed logging of the response
    console.log('TranscribeAudio: Google Speech API response received');
    console.log('Number of results:', response?.results?.length || 0);
    
    if (response && response.results) {
      response.results.forEach((result, index) => {
        console.log(`Result ${index}:`, JSON.stringify(result, null, 2));
      });
    }

    let transcription = "";
    if (response && Array.isArray(response.results) && response.results.length > 0) {
      transcription = response.results
        .map((r) => {
          if (r.alternatives && r.alternatives[0]) {
            console.log(`Alternative confidence: ${r.alternatives[0].confidence}`);
            return r.alternatives[0].transcript;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    console.log('TranscribeAudio: Final transcription:', transcription);

    if (!transcription || transcription.trim().length === 0) {
      console.log('TranscribeAudio: No transcription content detected');
      return res
        .status(200)
        .json(new ApiResponse(200, { text: "" }, "No speech detected"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { text: transcription }, "Transcribed successfully"));
  } catch (err) {
    console.error("Error transcribing:", err);
    
    // More detailed error logging
    if (err.details) {
      console.error("Google API Error details:", err.details);
    }
    
    throw new ApiError(500, "Transcription failed", [err.message || String(err)]);
  }
});