import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getOrCreateUser } from '../db/users.ts';
import { seedDefaultDataIfEmpty } from '../db/seedDefaults.ts';

export const userRouter = Router();

userRouter.get('/user/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@omnilife.local`;
    let user;
    try {
      user = await getOrCreateUser(uid, email, req.user!.name);
      await seedDefaultDataIfEmpty(uid);
    } catch (dbErr) {
      console.warn('PostgreSQL user sync notice (using session profile):', (dbErr as any)?.message || dbErr);
      user = { id: 1, uid, email, displayName: req.user!.name || email.split('@')[0], createdAt: new Date() };
    }
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Sync user error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});
