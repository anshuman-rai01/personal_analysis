import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { habits, habitLogs } from '../../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';

export const habitsRouter = Router();

habitsRouter.get('/habits', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const allHabits = await db.select().from(habits).where(eq(habits.userId, uid)).orderBy(desc(habits.id));
    const allLogs = await db.select().from(habitLogs).where(eq(habitLogs.userId, uid)).orderBy(desc(habitLogs.date));
    res.json({ habits: allHabits, logs: allLogs });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
});

habitsRouter.post('/habits', requireAuth, async (req: AuthRequest, res) => {
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

habitsRouter.post('/habits/:id/toggle', requireAuth, async (req: AuthRequest, res) => {
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

habitsRouter.delete('/habits/:id', requireAuth, async (req: AuthRequest, res) => {
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
