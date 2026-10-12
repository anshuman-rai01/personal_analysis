import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { studySessions, goals } from '../../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';

export const studyRouter = Router();

studyRouter.get('/study', requireAuth, async (req: AuthRequest, res) => {
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

studyRouter.post('/study', requireAuth, async (req: AuthRequest, res) => {
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

studyRouter.delete('/study/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(studySessions).where(and(eq(studySessions.id, id), eq(studySessions.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});
