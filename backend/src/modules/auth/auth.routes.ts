import { Router } from 'express';
import { requireAuth, requireFirebaseToken, AuthRequest, cacheRegistration } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { users } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { registerUser } from '../../db/users.ts';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Creates a users row for the verified Firebase token's uid.
 * Idempotent: existing user returns 200 with created: false.
 * Uses requireFirebaseToken (no registration check).
 */
authRouter.post('/auth/register', requireFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || '';

    // Optional displayName from body, trimmed, max 80 chars, control chars stripped
    let displayName = req.user!.name || null;
    if (req.body && typeof req.body.displayName === 'string') {
      const cleaned = req.body.displayName
        .replace(/[\x00-\x1f\x7f]/g, '') // strip control characters
        .trim()
        .slice(0, 80);
      if (cleaned.length > 0) {
        displayName = cleaned;
      }
    }

    const { user, created } = await registerUser(uid, email, displayName);
    cacheRegistration(uid);
    return res.status(created ? 201 : 200).json({ user, created });
  } catch (error: any) {
    console.error('Registration error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to register user.' });
  }
});

/**
 * GET /api/auth/session
 * Returns the registered user profile. Requires valid token + registration.
 */
authRouter.get('/auth/session', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userRows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (userRows.length === 0) {
      return res.status(403).json({
        error: 'No account found. Please register first.',
        code: 'NOT_REGISTERED',
      });
    }
    return res.json({ user: userRows[0] });
  } catch (error: any) {
    console.error('Session check error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to check session.' });
  }
});
