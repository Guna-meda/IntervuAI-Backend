import mongoose from "mongoose";
import { Interview } from "../models/interview.model.js";
import { User } from "../models/user.model.js";
import { generateOverallInterviewSummary } from "./llm.controller.js";
import { v4 as uuidv4 } from 'uuid';

export const startInterview = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    console.log('Starting interview for firebaseUid:', firebaseUid);

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { role, totalRounds, interviewId } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'Role is required to start an interview' });
    }

    let newInterviewId = interviewId;

    // If interviewId is provided, check if it exists
    if (newInterviewId) {
      const existingInterview = await Interview.findOne({ interviewId: newInterviewId });
      if (existingInterview) {
        return res.status(400).json({ error: 'Interview ID already exists' });
      }
    } else {
      // Generate a new unique interviewId
      do {
        newInterviewId = uuidv4();
        const existingInterview = await Interview.findOne({ interviewId: newInterviewId });
        if (!existingInterview) break; // Exit loop if ID is unique
      } while (true); // Keep generating until a unique ID is found
    }

    // Create rounds
    let rounds = [];
    for (let i = 1; i <= (totalRounds || 3); i++) {
      rounds.push({
        roundNumber: i,
        status: 'not_started',
        questions: [],
        startedAt: null,
        completedAt: null
      });
    }

    const interview = await Interview.create({
      interviewId: newInterviewId,
      user: user._id,
      role: role || user.profile.role,
      totalRounds: totalRounds || 3,
      currentRound: 1,
      rounds,
      progress: 0,
      status: 'active',
      createdAt: new Date(),
      lastActiveAt: new Date()
    });

    await interview.populate('user', 'displayName profile');
    return res.status(201).json({
      interviewId: interview.interviewId,
      message: 'New interview started successfully',
      interview
    });
  } catch (error) {
    console.error('Error starting interview:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const getActiveInterview = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interviewId = req.params.interviewId;
    if (!interviewId) {
      return res.status(400).json({ error: "Interview ID is required" });
    }

    const interview = await Interview.findOne({
      interviewId,
      user: user._id
    }).populate('user', 'displayName profile');

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    return res.status(200).json({ interview });
  } catch (error) {
    console.error("Error fetching active interview:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const getInterviewStats = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interviews = await Interview.find({ user: user._id });

    const totalInterviews = interviews.length;
    const completedInterviews = interviews.filter(i => i.status === 'completed').length;
    const activeInterviews = interviews.filter(i => i.status === 'active').length;

    let totalScore = 0;
    let scoredInterviews = 0;

    interviews.forEach(interview => {
      if (interview.status === 'completed' && interview.rounds) {
        const completedRounds = interview.rounds.filter(round => round.status === 'completed');
        if (completedRounds.length > 0) {
          const interviewScore = completedRounds.reduce((sum, round) => {
            if (round.questions && round.questions.length > 0) {
              const roundScore = round.questions.reduce((roundSum, q) => roundSum + (q.score || 0), 0) / round.questions.length;
              return sum + roundScore;
            }
            return sum;
          }, 0) / completedRounds.length;

          totalScore += interviewScore;
          scoredInterviews++;
        }
      }
    });

    const averageScore = scoredInterviews > 0 ? Math.round((totalScore / scoredInterviews) * 10) / 10 : 0;
    const completionRate = totalInterviews > 0 ? Math.round((completedInterviews / totalInterviews) * 100) : 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentActivity = interviews.filter(i => new Date(i.createdAt) > oneWeekAgo).length;

    const totalPracticeTime = interviews.reduce((total, interview) => {
      if (interview.rounds) {
        return total + interview.rounds.filter(round => round.status === 'completed').length * 30;
      }
      return total;
    }, 0);

    const skillDistribution = {};
    interviews.forEach(interview => {
      if (interview.status === 'completed' && interview.rounds) {
        interview.rounds.forEach(round => {
          if (round.questions) {
            round.questions.forEach(question => {
              if (question.feedback) {
                const skills = ['javascript', 'react', 'node', 'python', 'java', 'sql', 'system design', 'algorithms'];
                skills.forEach(skill => {
                  if (question.feedback.toLowerCase().includes(skill)) {
                    skillDistribution[skill] = (skillDistribution[skill] || 0) + 1;
                  }
                });
              }
            });
          }
        });
      }
    });

    const stats = {
      totalInterviews,
      completedInterviews,
      activeInterviews,
      averageScore,
      completionRate,
      recentActivity,
      totalPracticeHours: Math.round(totalPracticeTime / 60),
      skillDistribution: Object.entries(skillDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {})
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching interview stats:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const getAllInterviews = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const { status, limit, sortBy = 'createdAt', order = 'desc' } = req.query;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let query = { user: user._id };
    if (status) {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const limitValue = limit ? parseInt(limit) : null;

    let interviewsQuery = Interview.find(query)
      .populate('user', 'displayName profile')
      .sort(sortOptions);

    if (limitValue) {
      interviewsQuery = interviewsQuery.limit(limitValue);
    }

    const interviews = await interviewsQuery;

    const enhancedInterviews = interviews.map(interview => {
      const interviewObj = interview.toObject();

      if (interviewObj.rounds && interviewObj.totalRounds) {
        const completedRounds = interviewObj.rounds.filter(round => round.status === 'completed').length;
        interviewObj.progressPercentage = Math.round((completedRounds / interviewObj.totalRounds) * 100);
      } else {
        interviewObj.progressPercentage = 0;
      }

      interviewObj.overallScore = 0;
      if (interviewObj.status === 'completed' && interviewObj.rounds) {
        const completedRounds = interviewObj.rounds.filter(round => round.status === 'completed');
        if (completedRounds.length > 0) {
          const totalScore = completedRounds.reduce((sum, round) => {
            if (round.questions && round.questions.length > 0) {
              const roundScore = round.questions.reduce((roundSum, q) => roundSum + (q.score || 0), 0) / round.questions.length;
              return sum + roundScore;
            }
            return sum;
          }, 0);
          interviewObj.overallScore = Math.round((totalScore / completedRounds.length) * 10) / 10;
        }
      }

      interviewObj.formattedCreatedAt = new Date(interviewObj.createdAt).toLocaleDateString();
      interviewObj.formattedLastActive = new Date(interviewObj.lastActiveAt).toLocaleDateString();

      return interviewObj;
    });

    return res.status(200).json({
      interviews: enhancedInterviews,
      totalCount: interviews.length,
      activeCount: interviews.filter(i => i.status === 'active').length,
      completedCount: interviews.filter(i => i.status === 'completed').length
    });
  } catch (error) {
    console.error("Error fetching interviews:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const getInterviewDetails = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const firebaseUid = req.firebaseUid;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interview = await Interview.findOne({
      interviewId,
      user: user._id
    }).populate('user', 'displayName profile');

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const interviewObj = interview.toObject();

    if (interviewObj.rounds) {
      interviewObj.rounds = interviewObj.rounds.map(round => {
        const roundObj = { ...round };
        if (round.questions && round.questions.length > 0) {
          const totalScore = round.questions.reduce((sum, q) => sum + (q.score || 0), 0);
          roundObj.averageScore = Math.round((totalScore / round.questions.length) * 10) / 10;
          roundObj.maxScore = Math.max(...round.questions.map(q => q.score || 0));
          roundObj.minScore = Math.min(...round.questions.map(q => q.score || 0));
        } else {
          roundObj.averageScore = 0;
          roundObj.maxScore = 0;
          roundObj.minScore = 0;
        }
        return roundObj;
      });
    }

    if (interviewObj.rounds && interviewObj.totalRounds) {
      const completedRounds = interviewObj.rounds.filter(round => round.status === 'completed').length;
      interviewObj.progressPercentage = Math.round((completedRounds / interviewObj.totalRounds) * 100);
    }

    return res.status(200).json({ interview: interviewObj });
  } catch (error) {
    console.error("Error fetching interview details:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const completeRound = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { roundNumber, questions, roundFeedback } = req.body;
    const firebaseUid = req.firebaseUid;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interview = await Interview.findOne({
      interviewId,
      user: user._id
    }).populate('user', 'displayName profile');

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    // Validate round number
    if (roundNumber < 1 || roundNumber > interview.totalRounds) {
      return res.status(400).json({ error: "Invalid round number" });
    }

    const roundIndex = roundNumber - 1;

    // Update the round with all questions, answers, and feedback
    interview.rounds[roundIndex] = {
      roundNumber,
      status: "completed",
      questions: questions,
      startedAt: interview.rounds[roundIndex]?.startedAt || new Date(),
      completedAt: new Date()
    };

    // Update interview progress
    interview.currentRound = roundNumber + 1;
    const completedRounds = interview.rounds.filter(round => round.status === "completed").length;
    interview.progress = Math.round((completedRounds / interview.totalRounds) * 100);

    // If all rounds completed, mark interview as completed and generate overall feedback
    if (roundNumber === interview.totalRounds) {
      interview.status = "completed";
      interview.completedAt = new Date();
      interview.overallFeedback = roundFeedback;

      try {
        const overallSummary = await generateOverallInterviewSummary(interview);
        interview.overallSummary = overallSummary;
      } catch (error) {
        console.error("Error generating overall summary:", error);
      }
    }

    interview.lastActiveAt = new Date();
    await interview.save();
    await interview.populate('user', 'displayName profile');

    return res.status(200).json({
      message: `Round ${roundNumber} completed successfully`,
      progress: interview.progress,
      status: interview.status,
      nextRound: interview.currentRound,
      interview
    });
  } catch (error) {
    console.error("Error completing round:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const startRound = async (req, res) => {
  try {
    const { interviewId, roundNumber } = req.params;
    const firebaseUid = req.firebaseUid;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interview = await Interview.findOne({
      interviewId,
      user: user._id
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const roundIndex = roundNumber - 1;

    if (!interview.rounds[roundIndex]) {
      interview.rounds[roundIndex] = {
        roundNumber: parseInt(roundNumber),
        status: "in_progress",
        questions: [],
        startedAt: new Date(),
        completedAt: null
      };
    } else {
      interview.rounds[roundIndex].status = "in_progress";
      interview.rounds[roundIndex].startedAt = new Date();
    }

    interview.lastActiveAt = new Date();
    await interview.save();

    return res.status(200).json({
      message: `Round ${roundNumber} started`,
      round: interview.rounds[roundIndex]
    });
  } catch (error) {
    console.error("Error starting round:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};

export const cancelInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const firebaseUid = req.firebaseUid;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interview = await Interview.findOne({
      interviewId,
      user: user._id
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    interview.status = "cancelled";
    interview.lastActiveAt = new Date();
    await interview.save();

    return res.status(200).json({
      message: "Interview cancelled successfully",
      interview: {
        interviewId: interview.interviewId,
        status: interview.status,
        lastActiveAt: interview.lastActiveAt
      }
    });
  } catch (error) {
    console.error("Error cancelling interview:", error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};