import fetch from "node-fetch";
import { ApiError } from "../utils/ApiError.js";

class WhisperService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  async transcribeAudio(buffer, filename = "audio.webm") {
    try {
      const formData = new FormData();
      formData.append("file", buffer, filename);
      formData.append("model", "whisper-1");
      formData.append("language", "en");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new ApiError(response.status, `Whisper API error: ${errText}`);
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to transcribe audio", [], error.stack);
    }
  }
}

export default new WhisperService();
