import { OpenAI } from "openai";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateFollowUpQuestion = asyncHandler(async (req, res) => {
  const { currentQuestion, userResponse } = req.body;

  // Validate input
  if (!currentQuestion || !userResponse) {
    throw new ApiError(400, "Both currentQuestion and userResponse are required");
  }

  try {
    console.log('Generating follow-up question for:', {
      currentQuestion,
      userResponse: userResponse.substring(0, 100) + '...' // Log first 100 chars
    });

    const prompt = `
You are an expert technical interviewer. Given the original question and the candidate's response, generate one concise, relevant follow-up question that digs deeper into their technical experience, skills, or specific projects mentioned.

Original Question: "${currentQuestion}"
Candidate's Response: "${userResponse}"

Generate one technical follow-up question that explores their experience in more depth. Focus on technical specifics, implementation details, or challenges faced.

Follow-up Question:
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a technical interview specialist focusing on software development, engineering practices, and technical depth."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const followUpQuestion = completion.choices[0]?.message?.content?.trim();

    if (!followUpQuestion) {
      throw new ApiError(500, "Failed to generate follow-up question");
    }

    console.log('Generated follow-up:', followUpQuestion);

    return res
      .status(200)
      .json(new ApiResponse(200, { followUpQuestion }, "Follow-up question generated successfully"));

  } catch (error) {
    console.error("OpenAI API error:", error);
    
    // Fallback follow-up questions if API fails
    const fallbackQuestions = [
      "Fallback Question: Can you describe a challenging technical problem you faced and how you resolved it?",
      "Fallback Question: What tools or technologies do you prefer for debugging and why?",
      "Fallback Question: How do you stay updated with the latest developments in your technical field?",
      "Fallback Question: Can you explain a project where you had to learn a new technology quickly?",
      "Fallback Question: How do you approach optimizing code for performance?"
    ];
    
    const randomFallback = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    
    return res
      .status(200)
      .json(new ApiResponse(200, { followUpQuestion: randomFallback }, "Used fallback follow-up question"));
  }
});