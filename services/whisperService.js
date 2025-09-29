import fetch from "node-fetch";
import { ApiError } from "../utils/ApiError.js";

class WhisperService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

async transcribeAudio(buffer, filename = "audio.webm") {
  try {
    console.log(`Transcribing audio: ${filename}, size: ${buffer.length} bytes`);
    
    const formData = new FormData();
    const audioBlob = new Blob([buffer], { type: 'audio/webm' });
    formData.append("file", audioBlob, filename);
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    console.log(`Whisper API response status: ${response.status}`);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Whisper API error ${response.status}:`, errText);
      throw new ApiError(response.status, `Whisper API error: ${errText}`);
    }

    const data = await response.json();
    console.log('Transcription successful:', data.text.substring(0, 100) + '...');
    return data.text;
  } catch (error) {
    console.error('Transcription failed:', error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to transcribe audio", [], error.stack);
  }
}
}

export default new WhisperService();
