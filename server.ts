import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  users,
  studySessions,
  financeTransactions,
  habits,
  habitLogs,
  goals,
  simulationScenarios,
  forecastModels,
} from './src/db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  generateProjectGuidePDF,
  generatePresentationScriptPDF,
  generateIEEEPaperPDF,
} from './src/lib/pdfGenerator.ts';
import { assistantRouter } from './src/routes/assistant.ts';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));


// Seed default data for first-time users if empty
async function seedDefaultDataIfEmpty(uid: string) {
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

// ---------------- USER PROFILE ROUTE ----------------
app.get('/api/user/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@omnilife.local`;
    const user = await getOrCreateUser(uid, email, req.user!.name);
    await seedDefaultDataIfEmpty(uid);
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Sync user error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

// ---------------- STUDY SESSIONS ROUTES ----------------
app.get('/api/study', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const records = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.userId, uid))
      .orderBy(desc(studySessions.date), desc(studySessions.id));
    res.json(records);
  } catch (error: any) {
    console.error('Fetch study sessions failed:', error);
    res.status(500).json({ error: 'Failed to fetch study sessions' });
  }
});

app.post('/api/study', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { subject, topic, durationMinutes, technique, focusScore, energyScore, date, notes } = req.body;

    if (!subject || !topic || !durationMinutes) {
      return res.status(400).json({ error: 'Subject, topic, and duration are required.' });
    }

    const inserted = await db
      .insert(studySessions)
      .values({
        userId: uid,
        subject,
        topic,
        durationMinutes: parseInt(durationMinutes, 10),
        technique: technique || 'Pomodoro',
        focusScore: parseInt(focusScore || '7', 10),
        energyScore: parseInt(energyScore || '7', 10),
        date: date || new Date().toISOString().split('T')[0],
        notes: notes || '',
      })
      .returning();

    // Auto-update study goals progress if exists
    try {
      const studyGoals = await db.select().from(goals).where(and(eq(goals.userId, uid), eq(goals.module, 'study')));
      for (const g of studyGoals) {
        const addedHours = (parseInt(durationMinutes, 10) / 60);
        await db.update(goals)
          .set({ currentValue: Math.round((g.currentValue + addedHours) * 10) / 10 })
          .where(eq(goals.id, g.id));
      }
    } catch (e) {
      console.warn('Auto goal update error:', e);
    }

    res.json(inserted[0]);
  } catch (error: any) {
    console.error('Create study session failed:', error);
    res.status(500).json({ error: 'Failed to create study session' });
  }
});

app.delete('/api/study/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(studySessions).where(and(eq(studySessions.id, id), eq(studySessions.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ---------------- FINANCE TRANSACTIONS ROUTES ----------------
app.get('/api/finance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const records = await db
      .select()
      .from(financeTransactions)
      .where(eq(financeTransactions.userId, uid))
      .orderBy(desc(financeTransactions.date), desc(financeTransactions.id));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch financial transactions' });
  }
});

app.post('/api/finance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { title, type, category, amount, paymentMethod, date, notes } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ error: 'Title and amount are required.' });
    }

    const inserted = await db
      .insert(financeTransactions)
      .values({
        userId: uid,
        title,
        type: type || 'expense',
        category: category || 'General',
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'Bank Transfer',
        date: date || new Date().toISOString().split('T')[0],
        notes: notes || '',
      })
      .returning();

    // Auto-update finance goals if investment/savings
    if (type === 'investment' || type === 'savings') {
      try {
        const finGoals = await db.select().from(goals).where(and(eq(goals.userId, uid), eq(goals.module, 'finance')));
        for (const g of finGoals) {
          await db.update(goals)
            .set({ currentValue: Math.round(g.currentValue + parseFloat(amount)) })
            .where(eq(goals.id, g.id));
        }
      } catch (e) {
        console.warn('Auto goal update error:', e);
      }
    }

    res.json(inserted[0]);
  } catch (error: any) {
    console.error('Create finance transaction failed:', error);
    res.status(500).json({ error: 'Failed to create financial transaction' });
  }
});

app.delete('/api/finance/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(financeTransactions).where(and(eq(financeTransactions.id, id), eq(financeTransactions.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// ---------------- HABITS & LOGS ROUTES ----------------
app.get('/api/habits', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const allHabits = await db.select().from(habits).where(eq(habits.userId, uid)).orderBy(desc(habits.id));
    const allLogs = await db.select().from(habitLogs).where(eq(habitLogs.userId, uid)).orderBy(desc(habitLogs.date));
    res.json({ habits: allHabits, logs: allLogs });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
});

app.post('/api/habits', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { name, category, frequency, targetDaysPerWeek, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Habit name is required.' });
    }

    const inserted = await db
      .insert(habits)
      .values({
        userId: uid,
        name,
        category: category || 'Productivity',
        frequency: frequency || 'daily',
        targetDaysPerWeek: parseInt(targetDaysPerWeek || '7', 10),
        currentStreak: 0,
        longestStreak: 0,
        color: color || '#3b82f6',
        icon: icon || 'sparkles',
      })
      .returning();

    res.json(inserted[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create habit' });
  }
});

app.post('/api/habits/:id/toggle', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const habitId = parseInt(req.params.id, 10);
    const dateStr = req.body.date || new Date().toISOString().split('T')[0];

    const existingLog = await db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, uid), eq(habitLogs.date, dateStr)));

    let completedState = 1;
    if (existingLog.length > 0) {
      completedState = existingLog[0].completed === 1 ? 0 : 1;
      await db
        .update(habitLogs)
        .set({ completed: completedState })
        .where(eq(habitLogs.id, existingLog[0].id));
    } else {
      await db.insert(habitLogs).values({
        habitId,
        userId: uid,
        date: dateStr,
        completed: 1,
        moodScore: 5,
        durationMinutes: 20,
        notes: 'Logged daily session',
      });
    }

    // Recalculate streak
    const logs = await db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.completed, 1)))
      .orderBy(desc(habitLogs.date));

    const habitItem = await db.select().from(habits).where(eq(habits.id, habitId));
    let newStreak = logs.length;
    let longestStreak = habitItem[0]?.longestStreak || 0;
    if (newStreak > longestStreak) longestStreak = newStreak;

    await db.update(habits).set({ currentStreak: newStreak, longestStreak }).where(eq(habits.id, habitId));

    res.json({ success: true, completed: completedState, streak: newStreak });
  } catch (error: any) {
    console.error('Toggle habit log error:', error);
    res.status(500).json({ error: 'Failed to toggle habit log' });
  }
});

app.delete('/api/habits/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, id), eq(habitLogs.userId, uid)));
    await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete habit' });
  }
});

// ---------------- GOAL SETTING ROUTES ----------------
app.get('/api/goals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const records = await db.select().from(goals).where(eq(goals.userId, uid)).orderBy(desc(goals.id));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

app.post('/api/goals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { title, module, targetValue, currentValue, unit, deadline, milestones } = req.body;

    if (!title || !targetValue) {
      return res.status(400).json({ error: 'Title and target value are required.' });
    }

    const inserted = await db
      .insert(goals)
      .values({
        userId: uid,
        title,
        module: module || 'personal',
        targetValue: parseFloat(targetValue),
        currentValue: parseFloat(currentValue || '0'),
        unit: unit || 'Units',
        deadline: deadline || '2026-12-31',
        milestones: typeof milestones === 'string' ? milestones : JSON.stringify(milestones || []),
        status: 'in_progress',
      })
      .returning();

    res.json(inserted[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

app.put('/api/goals/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    const { currentValue, milestones, status } = req.body;

    const updates: any = {};
    if (currentValue !== undefined) updates.currentValue = parseFloat(currentValue);
    if (milestones !== undefined) updates.milestones = typeof milestones === 'string' ? milestones : JSON.stringify(milestones);
    if (status !== undefined) updates.status = status;

    const updated = await db
      .update(goals)
      .set(updates)
      .where(and(eq(goals.id, id), eq(goals.userId, uid)))
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

app.delete('/api/goals/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// ---------------- FORECASTING & PYTHON ML MODEL TRAINING ----------------
app.post('/api/ml/train', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { datasetType, customCsvContent } = req.body; // 'study' | 'finance' | 'habits'
    const type = datasetType || 'study';

    let csvTempPath = '';
    if (customCsvContent && typeof customCsvContent === 'string' && customCsvContent.length > 50) {
      csvTempPath = path.resolve(`temp_${Date.now()}_${type}.csv`);
      fs.writeFileSync(csvTempPath, customCsvContent, 'utf-8');
    }

    const scriptPath = path.resolve('python_service/ml_engine.py');
    const args = [scriptPath, 'train', type];
    if (csvTempPath) args.push(csvTempPath);

    const { stdout, stderr } = await execFileAsync('python3', args);
    if (csvTempPath && fs.existsSync(csvTempPath)) {
      fs.unlinkSync(csvTempPath);
    }

    if (stderr && !stdout) {
      console.error('Python ML training error:', stderr);
      return res.status(500).json({ error: 'Python ML training failed: ' + stderr });
    }

    const result = JSON.parse(stdout);

    // Save model record to PostgreSQL
    await db.insert(forecastModels).values({
      userId: uid,
      datasetType: type,
      recordCount: result.record_count || 1200,
      features: JSON.stringify(result.features),
      metrics: JSON.stringify({
        r2: result.r2_score,
        mae: result.mae,
        mse: result.mse,
        featureImportances: result.feature_importances,
        forecastSeries: result.forecast_series,
      }),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Train ML endpoint error:', error);
    res.status(500).json({ error: error.message || 'Failed to train forecasting model' });
  }
});

app.get('/api/ml/models', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const models = await db
      .select()
      .from(forecastModels)
      .where(eq(forecastModels.userId, uid))
      .orderBy(desc(forecastModels.trainedAt));
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch trained models' });
  }
});

// ---------------- SIMULATION & DECISION SCENARIOS ----------------
app.post('/api/simulation/run', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { scenarioType, params } = req.body;
    const scriptPath = path.resolve('python_service/ml_engine.py');
    const { stdout, stderr } = await execFileAsync('python3', [
      scriptPath,
      'simulate',
      scenarioType || 'study_career',
      JSON.stringify(params || {}),
    ]);

    if (stderr && !stdout) {
      return res.status(500).json({ error: 'Simulation engine error: ' + stderr });
    }

    const result = JSON.parse(stdout);
    res.json(result);
  } catch (error: any) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: error.message || 'Failed to run simulation' });
  }
});

app.post('/api/simulation/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { name, category, parameters, projections, riskScore, recommendations } = req.body;

    const inserted = await db
      .insert(simulationScenarios)
      .values({
        userId: uid,
        name: name || 'Custom Scenario',
        category: category || 'study_career',
        parameters: typeof parameters === 'string' ? parameters : JSON.stringify(parameters),
        projections: typeof projections === 'string' ? projections : JSON.stringify(projections),
        riskScore: parseInt(riskScore || '25', 10),
        recommendations: Array.isArray(recommendations) ? recommendations.join('; ') : (recommendations || ''),
      })
      .returning();

    res.json(inserted[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save simulation scenario' });
  }
});

app.get('/api/simulation/saved', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const scenarios = await db
      .select()
      .from(simulationScenarios)
      .where(eq(simulationScenarios.userId, uid))
      .orderBy(desc(simulationScenarios.createdAt));
    res.json(scenarios);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch saved scenarios' });
  }
});

app.delete('/api/simulation/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(simulationScenarios).where(and(eq(simulationScenarios.id, id), eq(simulationScenarios.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});

// ---------------- ASSISTANT API ROUTE ----------------
app.use('/api/assistant', assistantRouter);

// ---------------- DASHBOARD AGGREGATED METRICS ROUTE ----------------
app.get('/api/dashboard/overview', requireAuth, async (req: AuthRequest, res) => {
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

// ---------------- EXPORT PROJECT GUIDE AS PDF ----------------
app.get('/api/download-guide-pdf', async (_req, res) => {
  try {
    const pdfBuffer = await generateProjectGuidePDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="OmniLife_Studio_Mentor_Guide.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF document' });
  }
});

// ---------------- EXPORT PRESENTATION SCRIPT AS PDF ----------------
app.get('/api/download-presentation-script-pdf', async (_req, res) => {
  try {
    const pdfBuffer = await generatePresentationScriptPDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="OmniLife_Studio_Mentor_Presentation_Script.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Presentation script PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate Presentation Script PDF' });
  }
});

// ---------------- EXPORT IEEE FORMAT PAPER AS PDF ----------------
app.get('/api/download-ieee-paper-pdf', async (_req, res) => {
  try {
    const pdfBuffer = await generateIEEEPaperPDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="OmniLife_Studio_IEEE_Paper.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('IEEE Paper PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate IEEE Paper PDF' });
  }
});

// Setup Vite middleware for local development
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OmniLife Studio full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
