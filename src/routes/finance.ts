import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import { financeTransactions, goals } from '../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';

export const financeRouter = Router();

financeRouter.get('/finance', requireAuth, async (req: AuthRequest, res) => {
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

financeRouter.post('/finance', requireAuth, async (req: AuthRequest, res) => {
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

financeRouter.delete('/finance/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(financeTransactions).where(and(eq(financeTransactions.id, id), eq(financeTransactions.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});
