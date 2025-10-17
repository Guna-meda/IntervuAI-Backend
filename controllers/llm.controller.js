import { OpenAI } from "openai";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Interview } from "../models/interview.model.js";
import { User } from "../models/user.model.js";
import pRetry from "p-retry";

// Initialize OpenAI client with increased timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
});

// Helper function for retrying OpenAI API calls
const withRetry = async (fn, retries = 3, delay = 1000) => {
  return pRetry(fn, {
    retries,
    factor: 2,
    minTimeout: delay,
    onFailedAttempt: (error) => {
      console.error(`Retry attempt failed: ${error.message}`);
    },
  });
};

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

    let previousQAndA = '';
    if (interview.retakeOf) {
      const previousInterview = await Interview.findById(interview.retakeOf);
      if (previousInterview) {
        previousQAndA = `
PREVIOUS SIMILAR INTERVIEW (TO GENERATE SIMILAR BUT ADJUSTED QUESTIONS):
${previousInterview.rounds.map((round, index) => `
Round ${index + 1}:
${round.questions.map(q => `  - Question: ${q.question}\n    Answer: ${q.answer || 'Not provided'}\n    Score: ${q.score}/10`).join('\n')}
`).join('\n')}
`;
      }
    }

    const prompt = `
You are a senior ${interview.role} interviewer conducting a technical interview. Generate ONE technical question based on the candidate's profile, role requirements, past interview performance, and specified difficulty level.

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

${previousQAndA}

CURRENT INTERVIEW CONTEXT:
- Current Round: ${roundNumber}
- Total Rounds: ${interview.totalRounds}
- Difficulty Level: ${interview.difficulty || 'Intermediate'}
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
2. If this is a retake (previous Q&A provided), generate similar-themed questions but adjusted for the new difficulty level and avoid exact repeats
3. Tailor the question to the specified difficulty level: ${interview.difficulty || 'Intermediate'}
   - Beginner: Focus on basic concepts and fundamental knowledge
   - Intermediate: Include practical scenarios and moderate complexity
   - Advanced: Emphasize system design, optimization, and edge cases
4. Consider the candidate's skill level and past performance
5. Make it progressively challenging as rounds advance
6. Avoid repeating questions from previous rounds or the previous similar interview
7. Focus on ${interview.role}-specific technical concepts
8. Question should be clear, concise, and answerable in 2-3 minutes
9. Make it feel like a natural progression in the interview
10. Tailor to candidate's skills like MERN, Next.js, JS - avoid generic questions, focus on practical scenarios

Generate only the question text without any explanations or prefixes.

QUESTION:
`;

    // Log prompt preview before calling OpenAI
    try { 
      console.log('[LLM] generatePreparedQuestion prompt preview (truncated 1200 chars):', prompt.slice(0, 1200)); 
    } catch (e) { 
      console.warn('LLM log preview failed', e); 
    }

    const completion = await withRetry(async () => {
      console.log('Sending OpenAI request with payload:', {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a senior ${interview.role} technical interviewer. You ask insightful, role-specific technical questions that assess both depth and breadth of knowledge. You adapt your questions based on the candidate's experience level, past performance, and specified difficulty level.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      });
      return await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a senior ${interview.role} technical interviewer. You ask insightful, role-specific technical questions that assess both depth and breadth of knowledge. You adapt your questions based on the candidate's experience level, past performance, and specified difficulty level.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      });
    });

    console.log('OpenAI response:', completion);

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
    console.error("OpenAI API error:", {
      message: error.message,
      code: error.code,
      status: error.status,
      cause: error.cause,
    });
    
    // Fallback prepared questions based on role and difficulty
    const fallbackQuestions = {
      "Software Engineer": {
        Beginner: [
          "FQ -What is the difference between `let`, `const`, and `var` in JavaScript?",
          "FQ -Explain how a REST API works in simple terms.",
          "FQ -What is the purpose of a package.json file in a Node.js project?"
        ],
        Intermediate: [
          "FQ -Can you explain the difference between synchronous and asynchronous programming in JavaScript?",
          "FQ -How would you design a scalable microservices architecture for an e-commerce platform?",
          "FQ -What are the key principles of RESTful API design and why are they important?"
        ],
        Advanced: [
          "FQ -How would you optimize a Node.js application for high concurrency?",
          "FQ -Explain the CAP theorem and its implications for distributed systems.",
          "FQ -How would you implement rate limiting in a REST API?"
        ],
      },
      "Data Scientist": {
        Beginner: [
          "FQ -What is the difference between supervised and unsupervised learning?",
          "FQ -Explain what a p-value represents in statistical testing.",
          "FQ -What is the purpose of data normalization?"
        ],
        Intermediate: [
          "FQ -How would you handle missing values in a dataset and what are the trade-offs of different imputation methods?",
          "FQ -Can you explain the bias-variance tradeoff in machine learning and how it affects model selection?",
          "FQ -Describe a situation where you would use clustering algorithms and which one you'd choose."
        ],
        Advanced: [
          "FQ -How would you optimize a machine learning model for low-latency inference?",
          "FQ -Explain how you would handle imbalanced datasets in a classification problem.",
          "FQ -What are the trade-offs of using deep learning vs. traditional ML models?"
        ],
      },
      "Product Manager": {
        Beginner: [
          "FQ -What is a product roadmap and why is it important?",
          "FQ -How do you define a Minimum Viable Product (MVP)?",
          "FQ -What is the difference between a feature and a user story?"
        ],
        Intermediate: [
          "FQ -How do you prioritize features in a product roadmap?",
          "FQ -Can you walk me through how you'd conduct user research for a new feature?",
          "FQ -What metrics would you use to measure the success of a mobile app launch?"
        ],
        Advanced: [
          "FQ -How would you handle conflicting stakeholder priorities in product development?",
          "FQ -Explain how you would use A/B testing to optimize a product feature.",
          "FQ -How do you align product strategy with company OKRs?"
        ],
      },
      "UX Designer": {
        Beginner: [
          "FQ -What is the purpose of a user persona in UX design?",
          "FQ -Explain the difference between a wireframe and a prototype.",
          "FQ -What is usability testing and why is it important?"
        ],
        Intermediate: [
          "FQ -How do you approach creating user personas for a new project?",
          "FQ -Can you explain the difference between wireframes, mockups, and prototypes?",
          "FQ -How would you conduct usability testing for a web application?"
        ],
        Advanced: [
          "FQ -How would you design an accessible UI for users with visual impairments?",
          "FQ -Explain how you would use design systems to streamline UX workflows.",
          "FQ -How do you balance user needs with business goals in UX design?"
        ],
      },
      "DevOps Engineer": {
        Beginner: [
          "FQ -What is the difference between CI and CD in DevOps?",
          "FQ -Explain what a Docker container is in simple terms.",
          "FQ -What is the purpose of a configuration management tool?"
        ],
        Intermediate: [
          "FQ -Can you explain the key differences between Docker and Kubernetes?",
          "FQ -How would you set up a CI/CD pipeline for a microservices application?",
          "FQ -What monitoring tools have you used and how do you handle alerting?"
        ],
        Advanced: [
          "FQ -How would you implement zero-downtime deployments in Kubernetes?",
          "FQ -Explain how you would secure a CI/CD pipeline.",
          "FQ -How do you optimize infrastructure costs in a cloud environment?"
        ],
      },
      "Frontend Developer": {
        Beginner: [
          "FQ -What is the difference between `inline`, `block`, and `inline-block` in CSS?",
          "FQ -Explain what a component is in React.",
          "FQ -What is the purpose of the `useState` hook in React?"
        ],
        Intermediate: [
          "FQ -Can you explain how the Virtual DOM works in React?",
          "FQ -What are the differences between CSS Grid and Flexbox?",
          "FQ -How would you optimize a website for performance?"
        ],
        Advanced: [
          "FQ -How would you handle state management in a large-scale React application?",
          "FQ -Explain how you would implement lazy loading for a React app.",
          "FQ -What are the trade-offs of using Next.js vs. plain React?"
        ],
      },
      "Backend Developer": {
        Beginner: [
          "FQ -What is the difference between SQL and NoSQL databases?",
          "FQ -Explain what middleware is in Express.js.",
          "FQ -What is the purpose of environment variables in a Node.js application?"
        ],
        Intermediate: [
          "FQ -How do you handle database migrations in a production environment?",
          "FQ -What is the difference between REST and GraphQL?",
          "FQ -How would you implement authentication in a Node.js application?"
        ],
        Advanced: [
          "FQ -How would you design a scalable backend for real-time notifications?",
          "FQ -Explain how you would secure a GraphQL API against common attacks.",
          "FQ -What are the trade-offs of using serverless architecture vs. traditional servers?"
        ],
      },
    };

    const roleFallback = fallbackQuestions[Interview.role] || fallbackQuestions["Software Engineer"];
    const difficultyFallback = roleFallback[Interview.difficulty] || roleFallback["Intermediate"];
    const fallbackQuestion = difficultyFallback[Math.floor(Math.random() * difficultyFallback.length)];

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

export const generateOverallInterviewSummary = async (interview) => {
  try {
    const user = await User.findById(interview.user).select('profile');
    const userProfile = user?.profile || {};

    const allRoundsData = interview.rounds.map(round => ({
      roundNumber: round.roundNumber,
      questions: round.questions.map(q => ({
        question: q.question,
        answer: q.answer,
        answerSummary: q.answerSummary, // Use the summary instead of full answer
        feedback: q.feedback,
        score: q.score,
        expectedAnswer: q.expectedAnswer,
        keywords: q.keywords,
        type: q.questionType
      }))
    }));

    const prompt = `
You are analyzing a complete technical interview for a ${interview.role} position. Provide a well-structured, organized summary.

INTERVIEW DATA:
${JSON.stringify(allRoundsData, null, 2)}

CREATE A STRUCTURED SUMMARY WITH THESE SECTIONS:

STRENGTHS (3-4 bullet points):
- List key areas where candidate performed well
- Be specific about technical competencies
- Mention communication and problem-solving strengths

AREAS FOR IMPROVEMENT (3-4 bullet points):
- Identify specific technical gaps
- Suggest practical areas to focus on
- Be constructive and actionable

KEY RECOMMENDATIONS (3-4 bullet points):
- Provide concrete next steps for learning
- Suggest specific topics to study
- Include practice recommendations

OVERALL ASSESSMENT:
- Brief summary of performance
- Suitability for the role level
- Main takeaways

FORMAT REQUIREMENTS:
- Use clear, concise bullet points
- Avoid markdown formatting
- Keep language professional but easy to understand
- Focus on actionable insights
- Limit each section to 4 bullet points maximum

OUTPUT FORMAT:
Strengths:
• Point 1
• Point 2
• Point 3

Areas for Improvement:
• Point 1  
• Point 2
• Point 3

Recommendations:
• Point 1
• Point 2
• Point 3

Overall Assessment:
Brief summary here...
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a senior technical hiring manager. You provide clear, structured feedback that is easy to read and actionable. You avoid AI-sounding language and focus on practical insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1200,
      temperature: 0.7,
    });

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

    const prompt = `
You are a technical interviewer for a ${interview.role} position. Analyze the candidate's answer and provide comprehensive feedback.

QUESTION: "${question}"
CANDIDATE'S ANSWER: "${answer}"

REQUIREMENTS:
1. ANSWER SUMMARY: Create a concise 1-2 sentence summary of their response (for report display)
2. DETAILED FEEDBACK: Provide constructive technical feedback (2-3 sentences)
3. EXPECTED ANSWER: Provide a clear, simple expected answer that a human can easily understand. Use plain English, avoid complex jargon.
4. KEYWORDS: Extract 4-6 most important technical keywords/concepts from the expected answer
5. SCORE ASSESSMENT: Evaluate accuracy and provide score

OUTPUT FORMAT (as JSON):
{
  "accuracy": "excellent|good|partial|incorrect|idk",
  "answerSummary": "Brief summary of candidate's answer for report",
  "feedback": "Detailed technical feedback",
  "expectedAnswer": "Clear, simple expected answer in plain English",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "needsFollowUp": true|false,
  "followUpType": "deeper|clarification|rephrase|alternative|none"
}

IMPORTANT FOR EXPECTED ANSWER:
- Use simple, clear language
- Avoid complex technical jargon
- Make it easy to understand and remember
- Focus on core concepts
- Keep it practical and actionable

KEYWORDS REQUIREMENTS:
- 4-6 most important technical concepts
- Relevant to the question and answer
- Useful for quick revision
- Specific and meaningful

EXAMPLE:
Question: "What is React?"
Expected Answer: "React is a JavaScript library for building user interfaces. It lets you create reusable components and efficiently update the UI when data changes."
Keywords: ["components", "virtual dom", "jsx", "state", "props"]

Generate honest but helpful feedback.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a senior ${interview.role} technical interviewer. You provide clear, constructive feedback that helps candidates learn. You explain complex concepts in simple terms.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const feedbackData = JSON.parse(completion.choices[0]?.message?.content?.trim());

    if (!feedbackData) {
      throw new ApiError(500, "Failed to generate feedback");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { 
        accuracy: feedbackData.accuracy,
        answerSummary: feedbackData.answerSummary, // This is the summary for report
        feedback: feedbackData.feedback,
        expectedAnswer: feedbackData.expectedAnswer,
        keywords: feedbackData.keywords || [], // Keywords for quick revision
        needsFollowUp: feedbackData.needsFollowUp,
        followUpType: feedbackData.followUpType,
        score: calculateScoreFromAccuracy(feedbackData.accuracy)
      }, "Feedback generated successfully"));

  } catch (error) {
    console.error("OpenAI API error:", error);
    
    // Enhanced fallback with keywords
    return res
      .status(200)
      .json(new ApiResponse(200, { 
        accuracy: "partial",
        answerSummary: "Provided basic answer but needs more depth",
        feedback: "Thank you for your response. Let's continue with the next question.",
        expectedAnswer: "A complete response covering the main concepts clearly explained.",
        keywords: ["concepts", "fundamentals", "basics"],
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