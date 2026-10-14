import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
}

// --------------- Token verifier (injectable for tests) ---------------

type TokenVerifier = (token: string) => Promise<DecodedIdToken>;

let tokenVerifier: TokenVerifier = (token) => adminAuth.verifyIdToken(token);

/** Test-only: replace the token verifier so route tests never call Firebase. */
export function setTokenVerifier(fn: TokenVerifier): void {
  tokenVerifier = fn;
}

/** Test-only: restore the real verifier. */
export function resetTokenVerifier(): void {
  tokenVerifier = (token) => adminAuth.verifyIdToken(token);
}

// --------------- Registration cache (positive-only) ---------------

interface CacheEntry {
  expiresAt: number;
}

const registrationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds
const CACHE_MAX_SIZE = 5_000;

function isRegisteredCached(uid: string): boolean {
  const entry = registrationCache.get(uid);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    registrationCache.delete(uid);
    return false;
  }
  return true;
}

export function cacheRegistration(uid: string): void {
  // Evict oldest entries if cache is full
  if (registrationCache.size >= CACHE_MAX_SIZE) {
    const firstKey = registrationCache.keys().next().value;
    if (firstKey) registrationCache.delete(firstKey);
  }
  registrationCache.set(uid, { expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearRegistrationCache(): void {
  registrationCache.clear();
}

// --------------- Middleware helpers ---------------

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return token.length > 0 ? token : null;
}

// --------------- requireFirebaseToken (token valid, no registration check) ---------------

export const requireFirebaseToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Provide a valid Firebase ID token in the Authorization header.',
      code: 'UNAUTHENTICATED',
    });
  }

  try {
    const decodedToken = await tokenVerifier(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
    return next();
  } catch (error: any) {
    const isExpired = error?.code === 'auth/id-token-expired' ||
      error?.message?.includes('expired');
    return res.status(401).json({
      error: isExpired
        ? 'Token has expired. Please refresh and try again.'
        : 'Invalid authentication token.',
      code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED',
    });
  }
};

// --------------- requireAuth (token valid + registered user) ---------------

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Provide a valid Firebase ID token in the Authorization header.',
      code: 'UNAUTHENTICATED',
    });
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await tokenVerifier(token);
  } catch (error: any) {
    const isExpired = error?.code === 'auth/id-token-expired' ||
      error?.message?.includes('expired');
    return res.status(401).json({
      error: isExpired
        ? 'Token has expired. Please refresh and try again.'
        : 'Invalid authentication token.',
      code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED',
    });
  }

  const uid = decodedToken.uid;

  // Check registration cache first
  if (!isRegisteredCached(uid)) {
    // Query database
    try {
      const rows = await db.select({ uid: users.uid }).from(users).where(eq(users.uid, uid)).limit(1);
      if (rows.length === 0) {
        return res.status(403).json({
          error: 'No account found. Please register first.',
          code: 'NOT_REGISTERED',
        });
      }
      // Cache positive result
      cacheRegistration(uid);
    } catch (dbError: any) {
      console.error('Registration check DB error:', dbError?.message || dbError);
      return res.status(500).json({
        error: 'Internal server error during authentication.',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  req.user = {
    uid,
    email: decodedToken.email,
    name: decodedToken.name,
  };
  return next();
};
