import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import {
  studySessions,
  financeTransactions,
  habits,
  goals,
} from '../../db/schema.ts';
import { eq } from 'drizzle-orm';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const [allStudy, allFinance, allHabits, allGoals] = await Promise.all([
      db.select().from(studySessions).where(eq(studySessions.userId, uid)),
      db.select().from(financeTransactions).where(eq(financeTransactions.userId, uid)),
      db.select().from(habits).where(eq(habits.userId, uid)),
      db.select().from(goals).where(eq(goals.userId, uid)),
    ]);

    const totalStudyHours = Math.round((allStudy.reduce((acc, s) => acc + s.durationMinutes, 0) / 60) * 10) / 10;
    const avgFocusScore = allStudy.length ? Math.round((allStudy.reduce((acc, s) => acc + s.focusScore, 0) / allStudy.length) * 10) / 10 : 0;

    const totalIncome = allFinance.filter(f => f.type === 'income').reduce((acc, f) => acc + f.amount, 0);
    const totalExpenses = allFinance.filter(f => f.type === 'expense').reduce((acc, f) => acc + f.amount, 0);
    const totalInvested = allFinance.filter(f => f.type === 'investment' || f.type === 'savings').reduce((acc, f) => acc + f.amount, 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round(((netSavings) / totalIncome) * 100) : 0;

    const activeHabitCount = allHabits.length;
    const maxHabitStreak = allHabits.reduce((acc, h) => Math.max(acc, h.currentStreak), 0);
    const goalsAchieved = allGoals.filter(g => g.status === 'achieved').length;
    const goalsInProgress = allGoals.filter(g => g.status === 'in_progress').length;

    // Synergy index (0-100 score quantifying holistic habit, study, and financial harmony)
    const synergyIndex = Math.min(
      98,
      Math.max(25, Math.round((avgFocusScore * 4) + (Math.min(50, savingsRate) * 0.4) + (Math.min(20, maxHabitStreak) * 1.5) + 15))
    );

    res.json({
      study: {
        totalHours: totalStudyHours,
        sessionsCount: allStudy.length,
        avgFocus: avgFocusScore,
      },
      finance: {
        totalIncome,
        totalExpenses,
        totalInvested,
        netSavings,
        savingsRate,
      },
      habits: {
        activeCount: activeHabitCount,
        maxStreak: maxHabitStreak,
      },
      goals: {
        total: allGoals.length,
        inProgress: goalsInProgress,
        achieved: goalsAchieved,
      },
      synergyIndex,
    });
  } catch (error: any) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});
