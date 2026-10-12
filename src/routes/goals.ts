import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import { goals } from '../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';

export const goalsRouter = Router();

goalsRouter.get('/goals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const records = await db.select().from(goals).where(eq(goals.userId, uid)).orderBy(desc(goals.id));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

goalsRouter.post('/goals', requireAuth, async (req: AuthRequest, res) => {
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

goalsRouter.put('/goals/:id', requireAuth, async (req: AuthRequest, res) => {
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

goalsRouter.delete('/goals/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});
