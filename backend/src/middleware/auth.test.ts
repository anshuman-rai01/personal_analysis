import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  requireAuth,
  requireFirebaseToken,
  setTokenVerifier,
  resetTokenVerifier,
  cacheRegistration,
  clearRegistrationCache,
  AuthRequest,
} from './auth.ts';

describe('Auth Middleware Suite', () => {
  beforeEach(() => {
    clearRegistrationCache();
    resetTokenVerifier();
  });

  afterEach(() => {
    resetTokenVerifier();
    clearRegistrationCache();
  });

  describe('requireFirebaseToken', () => {
    function createApp() {
      const app = express();
      app.get('/test-token', requireFirebaseToken, (req: AuthRequest, res) => {
        res.json({ ok: true, user: req.user });
      });
      return app;
    }

    it('rejects requests with no Authorization header (401 UNAUTHENTICATED)', async () => {
      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-token`);
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'UNAUTHENTICATED');
      } finally {
        server.close();
      }
    });

    it('rejects requests with x-guest-uid alone (401 UNAUTHENTICATED)', async () => {
      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-token`, {
          headers: { 'x-guest-uid': 'guest_12345' },
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'UNAUTHENTICATED');
      } finally {
        server.close();
      }
    });

    it('rejects malformed token (401 UNAUTHENTICATED)', async () => {
      setTokenVerifier(async () => {
        const err: any = new Error('Decoding Firebase ID token failed');
        err.code = 'auth/argument-error';
        throw err;
      });

      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-token`, {
          headers: { Authorization: 'Bearer malformed.token.here' },
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'UNAUTHENTICATED');
      } finally {
        server.close();
      }
    });

    it('identifies expired token (401 TOKEN_EXPIRED)', async () => {
      setTokenVerifier(async () => {
        const err: any = new Error('Firebase ID token has expired');
        err.code = 'auth/id-token-expired';
        throw err;
      });

      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-token`, {
          headers: { Authorization: 'Bearer expired.token.here' },
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'TOKEN_EXPIRED');
      } finally {
        server.close();
      }
    });

    it('passes and attaches user for valid token', async () => {
      setTokenVerifier(async (token) => {
        if (token === 'valid.token') {
          return {
            uid: 'firebase_user_1',
            email: 'user1@example.com',
            name: 'User One',
          } as any;
        }
        throw new Error('invalid');
      });

      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-token`, {
          headers: { Authorization: 'Bearer valid.token' },
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.user.uid, 'firebase_user_1');
        assert.equal(data.user.email, 'user1@example.com');
      } finally {
        server.close();
      }
    });
  });

  describe('requireAuth regression matrix', () => {
    function createAuthedApp() {
      const app = express();
      app.get('/test-authed', requireAuth, (req: AuthRequest, res) => {
        res.json({ ok: true, uid: req.user?.uid });
      });
      return app;
    }

    it('rejects request with no header (401 UNAUTHENTICATED)', async () => {
      const app = createAuthedApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-authed`);
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'UNAUTHENTICATED');
      } finally {
        server.close();
      }
    });

    it('x-guest-uid alone gives 401 (guest header has no effect)', async () => {
      const app = createAuthedApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-authed`, {
          headers: { 'x-guest-uid': 'guest_abcdef' },
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'UNAUTHENTICATED');
      } finally {
        server.close();
      }
    });

    it('malformed token gives 401 UNAUTHENTICATED', async () => {
      setTokenVerifier(async () => {
        throw new Error('Malformed token');
      });

      const app = createAuthedApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-authed`, {
          headers: { Authorization: 'Bearer bad.token' },
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'UNAUTHENTICATED');
      } finally {
        server.close();
      }
    });

    it('expired token gives 401 TOKEN_EXPIRED', async () => {
      setTokenVerifier(async () => {
        const err: any = new Error('Token has expired');
        err.code = 'auth/id-token-expired';
        throw err;
      });

      const app = createAuthedApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-authed`, {
          headers: { Authorization: 'Bearer expired.token' },
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'TOKEN_EXPIRED');
      } finally {
        server.close();
      }
    });

    it('valid token with cached registration proceeds without DB query', async () => {
      const registeredUid = 'cached_reg_user_99';
      cacheRegistration(registeredUid);

      setTokenVerifier(async () => ({
        uid: registeredUid,
        email: 'cached@example.com',
      } as any));

      const app = createAuthedApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-authed`, {
          headers: { Authorization: 'Bearer valid.cached.token' },
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.uid, registeredUid);
        // Ensure default_user_101 is NEVER produced
        assert.notEqual(data.uid, 'default_user_101');
      } finally {
        server.close();
      }
    });
  });
});
