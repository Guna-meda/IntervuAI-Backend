import { OpenAI } from "openai";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Interview } from "../models/interview.model.js";
import { User } from "../models/user.model.js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generatePreparedQuestion = asyncHandler(async (req, res) => {
  const { interviewId, roundNumber, previousQuestions = [] } = req.body;
  const firebaseUid = req.firebaseUid;

  // Validate input
  if (!interviewId || !roundNumber) {
    throw new ApiError(400, "Interview ID and round number are required");
  }

  try {
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const interview = await Interview.findOne({ 
      interviewId, 
      user: user._id 
    }).populate('user', 'profile displayName');

    if (!interview) {
      throw new ApiError(404, "Interview not found");
    }

    // Get user's profile and past interview data for context
    const userProfile = user.profile || {};
    const pastInterviews = await Interview.find({
      user: user._id,
      status: "completed",
      _id: { $ne: interview._id }
    }).sort({ completedAt: -1 }).limit(3);

    console.log('Generating prepared question for round:', roundNumber);

    const prompt = `
You are a senior ${interview.role} interviewer conducting a technical interview. Generate ONE technical question based on the candidate's profile, role requirements, and past interview performance.

CANDIDATE PROFILE:
- Role Applied: ${interview.role}
- Experience: ${userProfile.parsedData?.experience || 'Not specified'}
- Skills: ${userProfile.skills?.join(', ') || userProfile.parsedData?.skills?.join(', ') || 'Not specified'}
- Background: ${userProfile.parsedData?.summary || 'Not specified'}

PAST INTERVIEW PERFORMANCE:
${pastInterviews.map(interview => `
Interview for ${interview.role} (${interview.completedAt?.toLocaleDateString() || 'Previous'}):
${interview.overallSummary ? `Summary: ${interview.overallSummary.substring(0, 200)}...` : 'No summary available'}
`).join('\n')}

CURRENT INTERVIEW CONTEXT:
- Current Round: ${roundNumber}
- Total Rounds: ${interview.totalRounds}
- Questions asked so far in this round: ${previousQuestions.length}
- Previous questions in this round:
${previousQuestions.map(q => `- ${q.question} (Score: ${q.score || 'N/A'})`).join('\n')}

PREVIOUS ROUNDS IN THIS INTERVIEW:
${interview.rounds.slice(0, roundNumber - 1).map((round, index) => `
Round ${index + 1}:
${round.questions.map(q => `  - ${q.question} (Score: ${q.score}/10)`).join('\n')}
`).join('\n')}

INSTRUCTIONS:
1. Generate ONE technical question appropriate for round ${roundNumber} of ${interview.totalRounds}
2. Consider the candidate's skill level and past performance
3. Make it progressively challenging as rounds advance
4. Avoid repeating questions from previous rounds
5. Focus on ${interview.role}-specific technical concepts
6. Question should be clear, concise, and answerable in 2-3 minutes
7. Make it feel like a natural progression in the interview
8. Tailor to candidate's skills like MERN, Next.js, JS - avoid generic questions, focus on practical scenarios

Generate only the question text without any explanations or prefixes.

QUESTION:
`;

    // Log prompt preview before calling OpenAI
    try { 
      console.log('[LLM] generatePreparedQuestion prompt preview (truncated 1200 chars):', prompt.slice(0, 1200)); 
    } catch (e) { 
      console.warn('LLM log preview failed', e); 
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a senior ${interview.role} technical interviewer. You ask insightful, role-specific technical questions that assess both depth and breadth of knowledge. You adapt your questions based on the candidate's experience level and past performance.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.8,
    });

    const preparedQuestion = completion.choices[0]?.message?.content?.trim();

    if (!preparedQuestion) {
      throw new ApiError(500, "Failed to generate prepared question");
    }

    console.log('Generated prepared question:', preparedQuestion);

    return res
      .status(200)
      .json(new ApiResponse(200, { 
        question: preparedQuestion,
        questionType: "prepared",
        roundNumber: roundNumber
      }, "Prepared question generated successfully"));

  } catch (error) {
    console.error("OpenAI API error:", error);
    
    // Fallback prepared questions based on role
    const fallbackQuestions = {
      "Software Engineer": [
        "Can you explain the difference between synchronous and asynchronous programming in JavaScript?",
        "How would you design a scalable microservices architecture for an e-commerce platform?",
        "What are the key principles of RESTful API design and why are they important?"
      ],
      "Data Scientist": [
        "How would you handle missing values in a dataset and what are the trade-offs of different imputation methods?",
        "Can you explain the bias-variance tradeoff in machine learning and how it affects model selection?",
        "Describe a situation where you would use clustering algorithms and which one you'd choose for high-dimensional data."
      ],
      "Product Manager": [
        "How do you prioritize features in a product roadmap?",
        "Can you walk me through how you'd conduct user research for a new feature?",
        "What metrics would you use to measure the success of a mobile app launch?"
      ],
      "UX Designer": [
        "How do you approach creating user personas for a new project?",
        "Can you explain the difference between wireframes, mockups, and prototypes?",
        "How would you conduct usability testing for a web application?"
      ],
      "DevOps Engineer": [
        "Can you explain the key differences between Docker and Kubernetes?",
        "How would you set up a CI/CD pipeline for a microservices application?",
        "What monitoring tools have you used and how do you handle alerting?"
      ],
      "Frontend Developer": [
        "Can you explain how the Virtual DOM works in React?",
        "What are the differences between CSS Grid and Flexbox?",
        "How would you optimize a website for performance?"
      ],
      "Backend Developer": [
        "How do you handle database migrations in a production environment?",
        "What is the difference between REST and GraphQL?",
        "How would you implement authentication in a Node.js application?"
      ],
    };

    const roleFallback = fallbackQuestions[interview.role] || fallbackQuestions["Software Engineer"];
    const fallbackQuestion = roleFallback[Math.floor(Math.random() * roleFallback.length)];

    return res
      .status(200)
      .json(new ApiResponse(200, { 
        question: fallbackQuestion,
        questionType: "prepared",
        roundNumber: roundNumber
      }, "Used fallback prepared question"));
  }
});

export const generateFollowUpQuestion = asyncHandler(async (req, res) => {
  const { 
    interviewId, 
    roundNumber, 
    currentQuestion, 
    userResponse, 
    previousQuestions = [],
    feedbackData,
    followUpType 
  } = req.body;

  // Validate input
  if (!interviewId || !roundNumber || !currentQuestion || !userResponse || !feedbackData) {
    throw new ApiError(400, "All parameters including feedback data are required");
  }

  try {
    const user = await User.findOne({ firebaseUid: req.firebaseUid });
    if (!user) throw new ApiError(404, "User not found");

    const interview = await Interview.findOne({ 
      interviewId, 
      user: user._id 
    }).populate('user', 'profile displayName');

    if (!interview) throw new ApiError(404, "Interview not found");

    const userProfile = user.profile || {};

    console.log('Generating context-aware follow-up question:', { followUpType });

    const prompt = `
You are conducting a technical interview. Based on the candidate's previous answer and its assessment, generate an appropriate follow-up question.

ORIGINAL QUESTION: "${currentQuestion}"
CANDIDATE'S ANSWER: "${userResponse}"
ANSWER ASSESSMENT: ${feedbackData.accuracy} - ${feedbackData.feedback}

FOLLOW-UP TYPE REQUESTED: ${followUpType}

CANDIDATE BACKGROUND:
- Role: ${interview.role}
- Skills: ${userProfile.skills?.join(', ') || 'Not specified'}

FOLLOW-UP STRATEGIES:
- "deeper": Ask a more advanced, related question to test depth
- "clarification": Ask them to clarify specific parts of their answer
- "rephrase": Ask the same concept in a different way to check understanding
- "alternative": Ask about different approaches or trade-offs
- "corrective": Gently correct and ask if they want to try again

Generate ONE follow-up question that matches the requested type and feels natural in conversation.

FOLLOW-UP QUESTION:
`;

  // Log prompt preview before calling OpenAI for follow-up question
  try { console.log('[LLM] generateFollowUpQuestion prompt preview (truncated 1200 chars):', prompt.slice(0, 1200)); } catch (e) { console.warn('LLM log preview failed', e); }

  const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an adaptive technical interviewer who tailors follow-up questions based on candidate performance. You maintain a professional but supportive tone.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 120,
      temperature: 0.7,
    });

  const followUpQuestion = completion.choices[0]?.message?.content?.trim();
  try { console.log('[LLM] generateFollowUpQuestion response preview (truncated 800 chars):', (completion?.choices?.[0]?.message?.content || '').slice(0, 800)); } catch (e) { }

    if (!followUpQuestion) {
      throw new ApiError(500, "Failed to generate follow-up question");
    }

    console.log('Generated context-aware follow-up:', followUpQuestion);

    return res
      .status(200)
      .json(new ApiResponse(200, { 
        followUpQuestion: followUpQuestion,
        questionType: "followup",
        roundNumber: roundNumber,
        parentQuestion: currentQuestion,
        followUpType: followUpType
      }, "Context-aware follow-up question generated"));

  } catch (error) {
    console.error("OpenAI API error:", error);
    
    const fallbackQuestions = {
      "deeper": "Can you explain this concept in more technical detail?",
      "clarification": "Could you clarify what you meant by that approach?",
      "rephrase": "Let me ask this differently to understand your perspective...",
      "alternative": "What alternative solutions might work for this problem?",
      "corrective": "I notice some gaps in that approach. Would you like to reconsider?"
    };
    
    const fallbackQuestion = fallbackQuestions[followUpType] || "Let's explore this topic further...";
    
    return res
      .status(200)
      .json(new ApiResponse(200, { 
        followUpQuestion: fallbackQuestion,
        questionType: "followup",
        roundNumber: roundNumber,
        parentQuestion: currentQuestion,
        followUpType: followUpType
      }, "Used fallback follow-up question"));
  }
});

// Enhanced Overall Interview Summary (already in your code)
export const generateOverallInterviewSummary = async (interview) => {
  try {
    const user = await User.findById(interview.user).select('profile');
    const userProfile = user?.profile || {};

    const allRoundsData = interview.rounds.map(round => ({
      roundNumber: round.roundNumber,
      questions: round.questions.map(q => ({
        question: q.question,
        answer: q.answer,
        feedback: q.feedback,
        score: q.score,
        type: q.questionType
      }))
    }));

    const prompt = `
You are analyzing a complete technical interview for a ${interview.role} position. Provide a comprehensive assessment that will help improve future interview questions and candidate evaluation.

CANDIDATE BACKGROUND:
- Role: ${interview.role}
- Experience: ${userProfile.parsedData?.experience || 'Not specified'}
- Key Skills: ${userProfile.skills?.join(', ') || userProfile.parsedData?.skills?.join(', ') || 'Not specified'}

INTERVIEW PERFORMANCE DATA:
${JSON.stringify(allRoundsData, null, 2)}

ANALYSIS REQUESTED:
1. TECHNICAL STRENGTHS: Identify 3-5 areas where candidate demonstrated strong proficiency
2. SKILL GAPS: Identify 3-5 technical areas needing improvement
3. PROBLEM-SOLVING APPROACH: Assess their methodology and creativity
4. COMMUNICATION EFFECTIVENESS: Evaluate clarity, depth, and technical articulation
5. ROLE SUITABILITY: Overall fit for ${interview.role} position
6. RECOMMENDATIONS FOR FUTURE INTERVIEWS: Specific areas to probe deeper in next interviews

Focus on actionable insights that can guide future interview question selection and difficulty adjustment.

Provide a structured but concise analysis.
`;

  try { console.log('[LLM] generateOverallInterviewSummary prompt preview (truncated 2000 chars):', prompt.slice(0, 2000)); } catch (e) { }

  const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a senior technical hiring manager with expertise in software engineering roles. You provide detailed, actionable feedback that helps optimize interview processes and candidate assessment."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

  try { console.log('[LLM] generateOverallInterviewSummary response preview (truncated 2000 chars):', (completion?.choices?.[0]?.message?.content || '').slice(0, 2000)); } catch (e) { }

  const summary = completion.choices[0]?.message?.content?.trim();
  return summary || "Interview analysis completed. Review individual rounds for detailed feedback.";

  } catch (error) {
    console.error("Error in generateOverallInterviewSummary:", error);
    return `Interview completed for ${interview.role} position. ${interview.totalRounds} rounds conducted with comprehensive technical assessment.`;
  }
};

export const generateAnswerFeedback = asyncHandler(async (req, res) => {
  const { question, answer, interviewId, roundNumber } = req.body;
  const firebaseUid = req.firebaseUid;

  if (!question || !answer || !interviewId) {
    throw new ApiError(400, "Question, answer, and interview ID are required");
  }

  try {
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const interview = await Interview.findOne({ 
      interviewId, 
      user: user._id 
    }).populate('user', 'profile displayName');

    if (!interview) {
      throw new ApiError(404, "Interview not found");
    }

    const userProfile = user.profile || {};

    console.log('Generating feedback for answer:', {
      question: question.substring(0, 100) + '...',
      answer: answer.substring(0, 100) + '...'
    });

    const prompt = `
You are a technical interviewer for a ${interview.role} position. Analyze the candidate's answer and provide comprehensive feedback.

QUESTION: "${question}"
CANDIDATE'S ANSWER: "${answer}"

CANDIDATE BACKGROUND:
- Role: ${interview.role}
- Skills: ${userProfile.skills?.join(', ') || userProfile.parsedData?.skills?.join(', ') || 'Not specified'}

ANALYSIS REQUIREMENTS:
1. ACCURACY ASSESSMENT: Evaluate how correct and complete the answer is
2. ANSWER SUMMARY: Create a concise 1-2 sentence summary of their response
3. DETAILED FEEDBACK: Provide detailed but concise technical feedback (2-4 sentences max)
4. FOLLOW-UP DECISION: Determine if a follow-up question is needed based on answer quality

OUTPUT FORMAT (as JSON):
{
  "accuracy": "excellent|good|partial|incorrect|idk",
  "summary": "Concise summary of their answer",
  "feedback": "Detailed technical feedback",
  "needsFollowUp": true|false,
  "followUpType": "deeper|clarification|rephrase|alternative|none"
}

ACCURACY LEVELS:
- "excellent": Comprehensive, correct, and detailed answer
- "good": Mostly correct with minor gaps
- "partial": Partially correct but significant gaps
- "incorrect": Mostly wrong or irrelevant
- "idk": Candidate explicitly says they don't know

FOLLOW-UP TYPES:
- "deeper": Ask deeper technical questions (for excellent/good answers)
- "clarification": Ask for clarification (for partial answers)
- "rephrase": Ask same question differently (for partial/incorrect)
- "alternative": Ask about alternative approaches (for good/partial)
- "none": No follow-up needed (for incorrect/idk)

Be honest but constructive in your assessment.
`;

    try { console.log('[LLM] generateAnswerFeedback prompt preview (truncated 1200 chars):', prompt.slice(0, 1200)); } catch (e) {}

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a senior ${interview.role} technical interviewer. You provide honest, constructive feedback that helps candidates improve. You're fair but rigorous in your assessment.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    try { console.log('[LLM] generateAnswerFeedback response preview (truncated 1200 chars):', (completion?.choices?.[0]?.message?.content || '').slice(0, 1200)); } catch (e) {}

    const feedbackData = JSON.parse(completion.choices[0]?.message?.content?.trim());

    if (!feedbackData) {
      throw new ApiError(500, "Failed to generate feedback");
    }

    console.log('Generated feedback:', feedbackData);

    return res
      .status(200)
      .json(new ApiResponse(200, { 
        accuracy: feedbackData.accuracy,
        summary: feedbackData.summary,
        feedback: feedbackData.feedback,
        needsFollowUp: feedbackData.needsFollowUp,
        followUpType: feedbackData.followUpType,
        score: calculateScoreFromAccuracy(feedbackData.accuracy)
      }, "Feedback generated successfully"));

  } catch (error) {
    console.error("OpenAI API error:", error);
    
    // Fallback feedback
    return res
      .status(200)
      .json(new ApiResponse(200, { 
        accuracy: "partial",
        summary: "Answer provided but needs more detail",
        feedback: "Thank you for your answer. Let's continue with the next question.",
        needsFollowUp: false,
        followUpType: "none",
        score: 5
      }, "Used fallback feedback"));
  }
});

// Helper function to calculate score from accuracy
const calculateScoreFromAccuracy = (accuracy) => {
  const scoreMap = {
    "excellent": 9,
    "good": 7,
    "partial": 5,
    "incorrect": 2,
    "idk": 1
  };
  return scoreMap[accuracy] || 5;
};