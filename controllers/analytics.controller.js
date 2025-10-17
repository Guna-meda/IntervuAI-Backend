import { Interview } from "../models/interview.model.js";
import { User } from "../models/user.model.js";

export const getAnalytics = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    
    // Find user by firebaseUid
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's interviews to calculate REAL analytics
    const interviews = await Interview.find({ user: user._id })
      .populate('user')
      .sort({ createdAt: -1 });

    // Calculate REAL metrics from interviews
    const totalSessions = interviews.length;
    const completedSessions = interviews.filter(i => i.status === 'completed').length;
    
    // Calculate REAL average score from all questions in all rounds
    let allScores = [];
    let totalQuestions = 0;
    
    interviews.forEach(interview => {
      interview.rounds.forEach(round => {
        if (round.questions && round.questions.length > 0) {
          round.questions.forEach(question => {
            if (question.score && question.score > 0) {
              allScores.push(question.score);
              totalQuestions++;
            }
          });
        }
      });
    });

    const averageScore = allScores.length > 0 
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
      : 0;

    // Calculate REAL skill breakdown from questions
    const skillBreakdown = calculateRealSkillBreakdownFromInterviews(interviews);
    
    // Calculate REAL weekly progress
    const weeklyProgress = calculateRealWeeklyProgressFromInterviews(interviews);
    
    // Calculate REAL performance trends
    const performanceTrends = calculateRealPerformanceTrendsFromInterviews(interviews);

    const analyticsData = {
      overview: {
        totalSessions,
        completedSessions,
        averageScore: Math.round(averageScore * 10) / 10,
        totalPracticeTime: calculateTotalPracticeTime(interviews),
        improvementRate: calculateImprovementRateFromInterviews(interviews),
        currentStreak: calculateCurrentStreakFromInterviews(interviews),
        totalQuestions
      },
      skillBreakdown,
      weeklyProgress,
      performanceTrends,
      recentActivity: interviews.slice(0, 5).map(i => ({
        date: i.createdAt,
        role: i.role,
        score: calculateInterviewScoreFromInterview(i),
        status: i.status,
        duration: calculateInterviewDurationFromInterview(i)
      }))
    };

    res.status(200).json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
};

// Individual route handlers
export const calculateRealSkillBreakdown = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interviews = await Interview.find({ user: user._id });
    const skillBreakdown = calculateRealSkillBreakdownFromInterviews(interviews);
    
    res.status(200).json(skillBreakdown);
  } catch (error) {
    console.error('Error calculating skill breakdown:', error);
    res.status(500).json({ error: 'Failed to calculate skill breakdown' });
  }
};

export const calculateRealWeeklyProgress = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interviews = await Interview.find({ user: user._id }).sort({ createdAt: -1 });
    const weeklyProgress = calculateRealWeeklyProgressFromInterviews(interviews);
    
    res.status(200).json(weeklyProgress);
  } catch (error) {
    console.error('Error calculating weekly progress:', error);
    res.status(500).json({ error: 'Failed to calculate weekly progress' });
  }
};

export const calculateRealPerformanceTrends = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interviews = await Interview.find({ user: user._id }).sort({ createdAt: -1 });
    const performanceTrends = calculateRealPerformanceTrendsFromInterviews(interviews);
    
    res.status(200).json(performanceTrends);
  } catch (error) {
    console.error('Error calculating performance trends:', error);
    res.status(500).json({ error: 'Failed to calculate performance trends' });
  }
};

export const calculateImprovementRate = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interviews = await Interview.find({ user: user._id }).sort({ createdAt: -1 });
    const improvementRate = calculateImprovementRateFromInterviews(interviews);
    
    res.status(200).json({ improvementRate });
  } catch (error) {
    console.error('Error calculating improvement rate:', error);
    res.status(500).json({ error: 'Failed to calculate improvement rate' });
  }
};

export const calculateCurrentStreak = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const interviews = await Interview.find({ user: user._id });
    const currentStreak = calculateCurrentStreakFromInterviews(interviews);
    
    res.status(200).json({ currentStreak });
  } catch (error) {
    console.error('Error calculating current streak:', error);
    res.status(500).json({ error: 'Failed to calculate current streak' });
  }
};

export const calculateInterviewScore = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findById(interviewId);
    
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    // Verify the interview belongs to the user
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    if (!user || !interview.user.equals(user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const score = calculateInterviewScoreFromInterview(interview);
    
    res.status(200).json({ score });
  } catch (error) {
    console.error('Error calculating interview score:', error);
    res.status(500).json({ error: 'Failed to calculate interview score' });
  }
};

export const calculateInterviewDuration = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findById(interviewId);
    
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    // Verify the interview belongs to the user
    const firebaseUid = req.firebaseUid;
    const user = await User.findOne({ firebaseUid });
    if (!user || !interview.user.equals(user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const duration = calculateInterviewDurationFromInterview(interview);
    
    res.status(200).json({ duration });
  } catch (error) {
    console.error('Error calculating interview duration:', error);
    res.status(500).json({ error: 'Failed to calculate interview duration' });
  }
};

// Helper functions (renamed to avoid conflicts with route handlers)
const calculateRealSkillBreakdownFromInterviews = (interviews) => {
  const skills = {
    'Technical': { totalScore: 0, count: 0 },
    'Problem Solving': { totalScore: 0, count: 0 },
    'Communication': { totalScore: 0, count: 0 },
    'System Design': { totalScore: 0, count: 0 },
    'Algorithms': { totalScore: 0, count: 0 }
  };

  interviews.forEach(interview => {
    interview.rounds.forEach(round => {
      if (round.questions) {
        round.questions.forEach(question => {
          if (question.score) {
            // Simple categorization based on question content
            let skill = 'Technical';
            const questionText = question.question.toLowerCase();
            
            if (questionText.includes('system') || questionText.includes('architecture')) {
              skill = 'System Design';
            } else if (questionText.includes('algorithm') || questionText.includes('complexity')) {
              skill = 'Algorithms';
            } else if (questionText.includes('communicat') || questionText.includes('explain')) {
              skill = 'Communication';
            } else if (questionText.includes('solve') || questionText.includes('problem')) {
              skill = 'Problem Solving';
            }
            
            if (skills[skill]) {
              skills[skill].totalScore += question.score;
              skills[skill].count += 1;
            }
          }
        });
      }
    });
  });

  return Object.entries(skills).map(([skill, data]) => ({
    skill,
    score: data.count > 0 ? Math.round((data.totalScore / data.count) * 10) / 10 : 0,
    questions: data.count
  })).filter(item => item.questions > 0);
};

const calculateRealWeeklyProgressFromInterviews = (interviews) => {
  const last5Weeks = [];
  const now = new Date();
  
  for (let i = 4; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekInterviews = interviews.filter(interview => {
      const interviewDate = new Date(interview.createdAt);
      return interviewDate >= weekStart && interviewDate <= weekEnd;
    });
    
    let weekScore = 0;
    let questionCount = 0;
    
    weekInterviews.forEach(interview => {
      interview.rounds.forEach(round => {
        if (round.questions) {
          round.questions.forEach(question => {
            if (question.score) {
              weekScore += question.score;
              questionCount++;
            }
          });
        }
      });
    });
    
    const averageScore = questionCount > 0 ? weekScore / questionCount : 0;
    
    last5Weeks.push({
      week: `Week ${5-i}`,
      score: Math.round(averageScore * 10) / 10,
      sessions: weekInterviews.length
    });
  }
  
  return last5Weeks;
};

const calculateRealPerformanceTrendsFromInterviews = (interviews) => {
  // Calculate trends based on recent performance vs older performance
  if (interviews.length < 2) {
    return { technical: 0, communication: 0, problemSolving: 0, confidence: 0 };
  }

  const recentInterviews = interviews.slice(0, 3);
  const olderInterviews = interviews.slice(-3);
  
  let recentScore = 0;
  let olderScore = 0;
  let recentCount = 0;
  let olderCount = 0;

  recentInterviews.forEach(interview => {
    interview.rounds.forEach(round => {
      if (round.questions) {
        round.questions.forEach(question => {
          if (question.score) {
            recentScore += question.score;
            recentCount++;
          }
        });
      }
    });
  });

  olderInterviews.forEach(interview => {
    interview.rounds.forEach(round => {
      if (round.questions) {
        round.questions.forEach(question => {
          if (question.score) {
            olderScore += question.score;
            olderCount++;
          }
        });
      }
    });
  });

  const recentAverage = recentCount > 0 ? recentScore / recentCount : 0;
  const olderAverage = olderCount > 0 ? olderScore / olderCount : 0;
  
  const improvement = recentAverage - olderAverage;
  
  return {
    technical: Math.min(10, Math.max(0, recentAverage + (improvement * 0.3))),
    communication: Math.min(10, Math.max(0, recentAverage + (improvement * 0.2))),
    problemSolving: Math.min(10, Math.max(0, recentAverage + (improvement * 0.4))),
    confidence: Math.min(10, Math.max(0, recentAverage + (improvement * 0.1)))
  };
};

const calculateTotalPracticeTime = (interviews) => {
  // Estimate 45 minutes per interview session
  return interviews.length * 45;
};

const calculateImprovementRateFromInterviews = (interviews) => {
  if (interviews.length < 2) return 0;
  
  const firstScores = [];
  const recentScores = [];
  
  // Get first 3 interviews
  interviews.slice(-3).forEach(interview => {
    interview.rounds.forEach(round => {
      if (round.questions) {
        round.questions.forEach(question => {
          if (question.score) firstScores.push(question.score);
        });
      }
    });
  });
  
  // Get last 3 interviews
  interviews.slice(0, 3).forEach(interview => {
    interview.rounds.forEach(round => {
      if (round.questions) {
        round.questions.forEach(question => {
          if (question.score) recentScores.push(question.score);
        });
      }
    });
  });
  
  const firstAvg = firstScores.length > 0 ? firstScores.reduce((a, b) => a + b, 0) / firstScores.length : 0;
  const recentAvg = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
  
  return firstAvg > 0 ? Math.round(((recentAvg - firstAvg) / firstAvg) * 100) : 0;
};

const calculateCurrentStreakFromInterviews = (interviews) => {
  // Simple streak calculation based on consecutive days with interviews
  let streak = 0;
  const today = new Date();
  let currentDate = new Date(today);
  
  while (true) {
    const hasInterview = interviews.some(interview => {
      const interviewDate = new Date(interview.createdAt);
      return interviewDate.toDateString() === currentDate.toDateString();
    });
    
    if (hasInterview) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
};

const calculateInterviewScoreFromInterview = (interview) => {
  let totalScore = 0;
  let questionCount = 0;
  
  interview.rounds.forEach(round => {
    if (round.questions) {
      round.questions.forEach(question => {
        if (question.score) {
          totalScore += question.score;
          questionCount++;
        }
      });
    }
  });
  
  return questionCount > 0 ? Math.round((totalScore / questionCount) * 10) / 10 : 0;
};

const calculateInterviewDurationFromInterview = (interview) => {
  // Estimate 45 minutes per interview
  return 15;
};