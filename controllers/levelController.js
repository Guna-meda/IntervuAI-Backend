// controllers/levelController.js
import { UserLevel } from '../models/UserLevel.model.js';

const LEVEL_REQUIREMENTS = {
  1: 0,
  2: 5,
  3: 20,
  4: 50,
  5: 75
};

const BADGE_CRITERIA = {
  'first_interview': { interviews: 1 },
  'quick_learner': { interviewsInWeek: 3 },
  'perfectionist': { score: 90 },
  'consistent': { interviews: 10 },
  'communication_pro': { communicationScore: 100 }
};

export const updateUserLevel = async (userId, newInterview = false) => {
  try {
    let userLevel = await UserLevel.findOne({ user: userId });
    
    if (!userLevel) {
      userLevel = new UserLevel({ user: userId });
    }

    if (newInterview) {
      userLevel.totalInterviews += 1;
      userLevel.completedInterviews += 1;
      userLevel.lastActivity = new Date();
    }

    // Calculate new level
    const newLevel = calculateLevel(userLevel.completedInterviews);
    const levelIncreased = newLevel > userLevel.currentLevel;
    userLevel.currentLevel = newLevel;

    // Check for new badges
    const newBadges = await checkBadgeEligibility(userLevel);
    if (newBadges.length > 0) {
      userLevel.badges.push(...newBadges);
    }

    // Update readiness score
    userLevel.readinessScore = calculateReadinessScore(userLevel);

    await userLevel.save();
    
    return {
      level: userLevel.currentLevel,
      levelIncreased,
      newBadges,
      interviewsToNextLevel: LEVEL_REQUIREMENTS[userLevel.currentLevel + 1] - userLevel.completedInterviews
    };
  } catch (error) {
    console.error('Error updating user level:', error);
    throw error;
  }
};

const calculateLevel = (interviewCount) => {
  if (interviewCount >= 75) return 5;
  if (interviewCount >= 50) return 4;
  if (interviewCount >= 20) return 3;
  if (interviewCount >= 5) return 2;
  return 1;
};

const calculateReadinessScore = (userLevel) => {
  const baseScore = Math.min(userLevel.completedInterviews * 2, 40);
  const consistencyBonus = calculateConsistencyBonus(userLevel);
  const performanceBonus = 35; // This would come from actual performance data
  return Math.min(baseScore + consistencyBonus + performanceBonus, 100);
};

const calculateConsistencyBonus = (userLevel) => {
  // Calculate based on recent activity frequency
  const recentActivity = userLevel.lastActivity;
  const daysSinceLastActivity = (new Date() - recentActivity) / (1000 * 60 * 60 * 24);
  return daysSinceLastActivity <= 7 ? 25 : 10;
};

const checkBadgeEligibility = async (userLevel) => {
  const newBadges = [];
  const badges = await getUserBadges(userLevel.user);

  // Check each badge criteria
  if (userLevel.completedInterviews >= 1 && !badges.find(b => b.badgeId === 'first_interview')) {
    newBadges.push({
      badgeId: 'first_interview',
      name: 'First Interview',
      description: 'Complete your first interview',
      earnedAt: new Date(),
      icon: '🎯'
    });
  }

  // Add more badge checks here...

  return newBadges;
};

export const getUserBadges = async (userId) => {
  const userLevel = await UserLevel.findOne({ user: userId });
  return userLevel?.badges || [];
};