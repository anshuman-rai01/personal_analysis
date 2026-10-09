import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    authenticated: boolean;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        authenticated: true,
      };
      return next();
    } catch (error) {
      console.warn('Bearer token verification failed, checking guest mode fallback:', error);
    }
  }

  // Support guest mode or preview session
  const guestUid = (req.headers['x-guest-uid'] as string) || 'default_user_101';
  req.user = {
    uid: guestUid,
    email: `${guestUid}@omnilife.local`,
    name: 'OmniLife User',
    authenticated: false,
  };
  next();
};
