import { db } from './index.ts';
import {
  studySessions,
  financeTransactions,
  habits,
  habitLogs,
  goals,
} from './schema.ts';
import { eq } from 'drizzle-orm';

/**
 * Seed initial demonstration data for first-time users if their profile tables are empty
 */
export async function seedDefaultDataIfEmpty(uid: string) {
  try {
    const existingStudy = await db.select().from(studySessions).where(eq(studySessions.userId, uid));
    if (existingStudy.length === 0) {
      await db.insert(studySessions).values([
        {
          userId: uid,
          subject: 'Machine Learning',
          topic: 'Gradient Descent & Regularization',
          durationMinutes: 90,
          technique: 'Deep Work',
          focusScore: 9,
          energyScore: 8,
          date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
          notes: 'Derived L2 ridge penalty equations and tested with learning rate 0.01.',
        },
        {
          userId: uid,
          subject: 'PostgreSQL Architecture',
          topic: 'Indexing & Query Optimization',
          durationMinutes: 60,
          technique: 'Pomodoro',
          focusScore: 8,
          energyScore: 7,
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          notes: 'Analyzed EXPLAIN ANALYZE on multi-column indexes for time-series data.',
        },
        {
          userId: uid,
          subject: 'Algorithms & Data Structures',
          topic: 'Dynamic Programming & Memoization',
          durationMinutes: 75,
          technique: 'Active Recall',
          focusScore: 9,
          energyScore: 8,
          date: new Date().toISOString().split('T')[0],
          notes: 'Solved 3 LeetCode hard problems on tree partition and knapsack variant.',
        },
      ]);
    }

    const existingFinance = await db.select().from(financeTransactions).where(eq(financeTransactions.userId, uid));
    if (existingFinance.length === 0) {
      await db.insert(financeTransactions).values([
        {
          userId: uid,
          title: 'Software Engineering Salary',
          type: 'income',
          category: 'Salary',
          amount: 6200.0,
          paymentMethod: 'Bank Transfer',
          date: new Date(Date.now() - 86400000 * 12).toISOString().split('T')[0],
          notes: 'Monthly direct deposit paycheck.',
        },
        {
          userId: uid,
          title: 'Tech Stack & Server Subscriptions',
          type: 'expense',
          category: 'Tech',
          amount: 145.0,
          paymentMethod: 'Credit Card',
          date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
          notes: 'Cloud hosting and developer tooling.',
        },
        {
          userId: uid,
          title: 'S&P 500 Index Fund Auto-Invest',
          type: 'investment',
          category: 'Investment',
          amount: 1800.0,
          paymentMethod: 'Bank Transfer',
          date: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0],
          notes: 'Automated dollar-cost averaging into low-cost index funds.',
        },
        {
          userId: uid,
          title: 'High-Yield Emergency Reserve',
          type: 'savings',
          category: 'Savings',
          amount: 800.0,
          paymentMethod: 'Bank Transfer',
          date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
          notes: 'Maintained 6-month living expense runway.',
        },
        {
          userId: uid,
          title: 'Organic Groceries & Meal Prep',
          type: 'expense',
          category: 'Food',
          amount: 320.0,
          paymentMethod: 'Credit Card',
          date: new Date().toISOString().split('T')[0],
          notes: 'Healthy nutrition for high-cognitive focus.',
        },
      ]);
    }

    const existingHabits = await db.select().from(habits).where(eq(habits.userId, uid));
    if (existingHabits.length === 0) {
      const inserted = await db.insert(habits).values([
        {
          userId: uid,
          name: 'Morning Cold Shower & Hydration',
          category: 'Health',
          frequency: 'daily',
          targetDaysPerWeek: 7,
          currentStreak: 14,
          longestStreak: 21,
          color: '#06b6d4',
          icon: 'droplets',
        },
        {
          userId: uid,
          name: '60-Minute Deep Work Block',
          category: 'Productivity',
          frequency: 'daily',
          targetDaysPerWeek: 6,
          currentStreak: 9,
          longestStreak: 18,
          color: '#8b5cf6',
          icon: 'brain',
        },
        {
          userId: uid,
          name: 'Strength Training or 5K Run',
          category: 'Fitness',
          frequency: '5x_weekly',
          targetDaysPerWeek: 5,
          currentStreak: 5,
          longestStreak: 12,
          color: '#10b981',
          icon: 'flame',
        },
        {
          userId: uid,
          name: 'Daily Expense Audit',
          category: 'Learning',
          frequency: 'daily',
          targetDaysPerWeek: 7,
          currentStreak: 11,
          longestStreak: 30,
          color: '#f59e0b',
          icon: 'wallet',
        },
      ]).returning();

      if (inserted && inserted.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        for (const h of inserted) {
          await db.insert(habitLogs).values([
            {
              habitId: h.id,
              userId: uid,
              date: yesterdayStr,
              completed: 1,
              moodScore: 5,
              durationMinutes: 25,
              notes: 'Completed effortlessly.',
            },
            {
              habitId: h.id,
              userId: uid,
              date: todayStr,
              completed: 1,
              moodScore: 5,
              durationMinutes: 30,
              notes: 'Great energy today!',
            },
          ]);
        }
      }
    }

    const existingGoals = await db.select().from(goals).where(eq(goals.userId, uid));
    if (existingGoals.length === 0) {
      await db.insert(goals).values([
        {
          userId: uid,
          title: 'Complete 120 Hours of Applied Machine Learning',
          module: 'study',
          targetValue: 120,
          currentValue: 48,
          unit: 'Hours',
          deadline: '2026-12-31',
          milestones: JSON.stringify([
            { id: 1, text: 'Supervised Learning & Regression Theory', done: true },
            { id: 2, text: 'Build & Train 1,200 Record Model', done: true },
            { id: 3, text: 'Time Series & Forecasting Pipeline', done: false },
            { id: 4, text: 'Production Deployment & Evaluation', done: false },
          ]),
          status: 'in_progress',
        },
        {
          userId: uid,
          title: 'Grow Liquid Investment Portfolio to $50,000',
          module: 'finance',
          targetValue: 50000,
          currentValue: 28500,
          unit: '$',
          deadline: '2027-06-30',
          milestones: JSON.stringify([
            { id: 1, text: 'Establish 6-Month Emergency Runway', done: true },
            { id: 2, text: 'Reach $25,000 in Index Funds', done: true },
            { id: 3, text: 'Automate 35% Monthly Savings Rate', done: true },
            { id: 4, text: 'Reach $50,000 Milestone', done: false },
          ]),
          status: 'in_progress',
        },
        {
          userId: uid,
          title: 'Achieve 30-Day Unbroken Habit Streak',
          module: 'habits',
          targetValue: 30,
          currentValue: 14,
          unit: 'Days',
          deadline: '2026-11-15',
          milestones: JSON.stringify([
            { id: 1, text: '7-Day Kickoff Streak', done: true },
            { id: 2, text: '14-Day Consistency Barrier', done: true },
            { id: 3, text: '21-Day Habit Crystallization', done: false },
            { id: 4, text: '30-Day Master Milestone', done: false },
          ]),
          status: 'in_progress',
        },
      ]);
    }
  } catch (err) {
    console.error('Error seeding default data:', err);
  }
}
