import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import {
  users,
  habits,
  habitLogs,
  studySessions,
  financeTransactions,
  goals,
  simulationScenarios,
} from './schema.ts';
import { apiRouter } from '../routes/index.ts';
import { setTokenVerifier, resetTokenVerifier } from '../middleware/auth.ts';

describe('User Data Isolation & Regression Suite (PostgreSQL)', () => {
  const testDbName = process.env.SQL_DB_NAME_TEST;

  if (!testDbName) {
    it('skips PostgreSQL isolation test when SQL_DB_NAME_TEST is unset', (t) => {
      t.skip('SQL_DB_NAME_TEST environment variable not set.');
    });
    return;
  }

  it('proves strict data isolation between two users, empty states for new user, and auth regression matrix', async () => {
    const pool = new Pool({
      host: process.env.SQL_HOST || 'localhost',
      port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD || '',
      database: testDbName,
      connectionTimeoutMillis: 5000,
    });

    const testDb = drizzle(pool, { schema });
    const ts = Date.now();
    const uidA = `test_iso_a_${ts}`;
    const emailA = `alice_${ts}@isolation.test`;
    const uidB = `test_iso_b_${ts}`;
    const emailB = `bob_${ts}@isolation.test`;
    const uidNew = `test_iso_new_${ts}`;
    const emailNew = `newbie_${ts}@isolation.test`;

    // Ephemeral express server
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    const server = app.listen(0);
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // Token verifier seam
    setTokenVerifier(async (token: string) => {
      if (token === 'token_alice') {
        return { uid: uidA, email: emailA, name: 'Alice' } as any;
      }
      if (token === 'token_bob') {
        return { uid: uidB, email: emailB, name: 'Bob' } as any;
      }
      if (token === 'token_newbie') {
        return { uid: uidNew, email: emailNew, name: 'Newbie' } as any;
      }
      if (token === 'token_unregistered') {
        return { uid: `unregistered_${ts}`, email: 'unregistered@test.com' } as any;
      }
      if (token === 'token_expired') {
        const err: any = new Error('Token expired');
        err.code = 'auth/id-token-expired';
        throw err;
      }
      const err: any = new Error('Invalid token');
      err.code = 'auth/argument-error';
      throw err;
    });

    try {
      // 1. Auth Regression Matrix Tests
      // Case A: No auth header -> 401 UNAUTHENTICATED
      const resNoHeader = await fetch(`${baseUrl}/api/dashboard/overview`);
      assert.equal(resNoHeader.status, 401);
      const jsonNoHeader = await resNoHeader.json();
      assert.equal(jsonNoHeader.code, 'UNAUTHENTICATED');

      // Case B: x-guest-uid alone -> 401 UNAUTHENTICATED (guest header ignored)
      const resGuestHeader = await fetch(`${baseUrl}/api/dashboard/overview`, {
        headers: { 'x-guest-uid': 'guest_malicious_123' },
      });
      assert.equal(resGuestHeader.status, 401);
      const jsonGuest = await resGuestHeader.json();
      assert.equal(jsonGuest.code, 'UNAUTHENTICATED');

      // Case C: Malformed token -> 401 UNAUTHENTICATED
      const resMalformed = await fetch(`${baseUrl}/api/dashboard/overview`, {
        headers: { Authorization: 'Bearer invalid_token_xyz' },
      });
      assert.equal(resMalformed.status, 401);
      const jsonMalformed = await resMalformed.json();
      assert.equal(jsonMalformed.code, 'UNAUTHENTICATED');

      // Case D: Expired token -> 401 TOKEN_EXPIRED
      const resExpired = await fetch(`${baseUrl}/api/dashboard/overview`, {
        headers: { Authorization: 'Bearer token_expired' },
      });
      assert.equal(resExpired.status, 401);
      const jsonExpired = await resExpired.json();
      assert.equal(jsonExpired.code, 'TOKEN_EXPIRED');

      // Case E: Valid token but unregistered -> 403 NOT_REGISTERED
      const resUnregistered = await fetch(`${baseUrl}/api/dashboard/overview`, {
        headers: { Authorization: 'Bearer token_unregistered' },
      });
      assert.equal(resUnregistered.status, 403);
      const jsonUnreg = await resUnregistered.json();
      assert.equal(jsonUnreg.code, 'NOT_REGISTERED');

      // 2. Register Alice and Bob
      const regAlice = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_alice',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Alice' }),
      });
      assert.equal(regAlice.status, 201);

      const regBob = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_bob',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Bob' }),
      });
      assert.equal(regBob.status, 201);

      // Verify session returns registered user
      const sessAlice = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: 'Bearer token_alice' },
      });
      assert.equal(sessAlice.status, 200);
      const userAlice = await sessAlice.json();
      assert.equal(userAlice.user.uid, uidA);

      // 3. User A creates records across study, finance, habits, goals, simulations
      const createStudyRes = await fetch(`${baseUrl}/api/study`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_alice',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Distributed Systems',
          topic: 'Raft Consensus',
          durationMinutes: 90,
          technique: 'Deep Work',
          focusScore: 9,
          energyScore: 8,
          date: '2026-10-12',
          notes: 'Leader election algorithm',
        }),
      });
      assert.ok([200, 201].includes(createStudyRes.status));
      const studyA = await createStudyRes.json();

      const createFinRes = await fetch(`${baseUrl}/api/finance`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_alice',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Cloud Compute',
          type: 'expense',
          category: 'Tech',
          amount: 150,
          paymentMethod: 'Credit Card',
          date: '2026-10-12',
        }),
      });
      assert.ok([200, 201].includes(createFinRes.status));
      const finA = await createFinRes.json();

      const createHabitRes = await fetch(`${baseUrl}/api/habits`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_alice',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Morning Code Review',
          category: 'Productivity',
          frequency: 'daily',
          targetDaysPerWeek: 7,
        }),
      });
      assert.ok([200, 201].includes(createHabitRes.status));
      const habitA = await createHabitRes.json();

      const createGoalRes = await fetch(`${baseUrl}/api/goals`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_alice',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Complete System Design Book',
          module: 'study',
          targetValue: 20,
          currentValue: 5,
          unit: 'Chapters',
          deadline: '2026-12-31',
          milestones: [{ id: 1, text: 'Part 1', done: false }],
        }),
      });
      assert.ok([200, 201].includes(createGoalRes.status));
      const goalA = await createGoalRes.json();

      const createSimRes = await fetch(`${baseUrl}/api/simulation/save`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_alice',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Conservative Growth Plan',
          category: 'wealth_accumulation',
          parameters: { savingsRate: 30 },
          projections: { netWorth: 100000 },
          riskScore: 25,
          recommendations: 'Consistent monthly investments',
        }),
      });
      assert.equal(createSimRes.status, 200);

      // 4. Isolation Checks: User B queries list endpoints and receives 0 of Alice's records
      const bStudy = await (await fetch(`${baseUrl}/api/study`, { headers: { Authorization: 'Bearer token_bob' } })).json();
      assert.equal(bStudy.length, 0, "User B must see 0 study sessions");

      const bFin = await (await fetch(`${baseUrl}/api/finance`, { headers: { Authorization: 'Bearer token_bob' } })).json();
      assert.equal(bFin.length, 0, "User B must see 0 finance transactions");

      const bHabits = await (await fetch(`${baseUrl}/api/habits`, { headers: { Authorization: 'Bearer token_bob' } })).json();
      assert.equal(bHabits.habits.length, 0, "User B must see 0 habits");
      assert.equal(bHabits.logs.length, 0, "User B must see 0 habit logs");

      const bGoals = await (await fetch(`${baseUrl}/api/goals`, { headers: { Authorization: 'Bearer token_bob' } })).json();
      assert.equal(bGoals.length, 0, "User B must see 0 goals");

      const bSim = await (await fetch(`${baseUrl}/api/simulation/saved`, { headers: { Authorization: 'Bearer token_bob' } })).json();
      assert.equal(bSim.length, 0, "User B must see 0 saved simulations");

      const bModels = await (await fetch(`${baseUrl}/api/ml/models`, { headers: { Authorization: 'Bearer token_bob' } })).json();
      assert.equal(bModels.length, 0, "User B must see 0 trained models");

      // 5. Cross-user Mutation Attacks: User B attempts to delete/modify Alice's records
      await fetch(`${baseUrl}/api/study/${studyA.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token_bob' },
      });
      const checkStudyA = await (await fetch(`${baseUrl}/api/study`, { headers: { Authorization: 'Bearer token_alice' } })).json();
      assert.equal(checkStudyA.length, 1, "Alice's study session must not be deleted by Bob");

      await fetch(`${baseUrl}/api/finance/${finA.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token_bob' },
      });
      const checkFinA = await (await fetch(`${baseUrl}/api/finance`, { headers: { Authorization: 'Bearer token_alice' } })).json();
      assert.equal(checkFinA.length, 1, "Alice's finance transaction must not be deleted by Bob");

      await fetch(`${baseUrl}/api/habits/${habitA.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token_bob' },
      });
      const checkHabitA = await (await fetch(`${baseUrl}/api/habits`, { headers: { Authorization: 'Bearer token_alice' } })).json();
      assert.equal(checkHabitA.habits.length, 1, "Alice's habit must not be deleted by Bob");

      await fetch(`${baseUrl}/api/goals/${goalA.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token_bob' },
      });
      const checkGoalA = await (await fetch(`${baseUrl}/api/goals`, { headers: { Authorization: 'Bearer token_alice' } })).json();
      assert.equal(checkGoalA.length, 1, "Alice's goal must not be deleted by Bob");

      // Attempt to modify Alice's goal milestone or title as Bob
      await fetch(`${baseUrl}/api/goals/${goalA.id}`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer token_bob',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'achieved', title: 'Hacked Title' }),
      });
      const verifyGoalA = await (await fetch(`${baseUrl}/api/goals`, { headers: { Authorization: 'Bearer token_alice' } })).json();
      assert.equal(verifyGoalA[0].status, 'in_progress', "Alice's goal status must remain unchanged");
      assert.equal(verifyGoalA[0].title, 'Complete System Design Book', "Alice's goal title must remain unchanged");

      // 6. Brand New User Dashboard Verification
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_newbie',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Brand New User' }),
      });

      const dashRes = await fetch(`${baseUrl}/api/dashboard/overview`, {
        headers: { Authorization: 'Bearer token_newbie' },
      });
      assert.equal(dashRes.status, 200);
      const dash = await dashRes.json();

      // Brand new user must see completely empty metrics and null synergy index
      assert.equal(dash.study.totalHours, 0);
      assert.equal(dash.study.sessionsCount, 0);
      assert.equal(dash.study.avgFocus, 0);
      assert.equal(dash.finance.totalIncome, 0);
      assert.equal(dash.finance.totalExpenses, 0);
      assert.equal(dash.finance.netSavings, 0);
      assert.equal(dash.habits.activeCount, 0);
      assert.equal(dash.habits.maxStreak, 0);
      assert.equal(dash.goals.total, 0);
      assert.equal(dash.goals.achieved, 0);
      assert.equal(dash.goals.inProgress, 0);
      assert.equal(dash.synergyIndex, null, 'Synergy index must be null for fresh user with no activity');
    } finally {
      resetTokenVerifier();
      server.close();

      // Clean test users from DB
      for (const u of [uidA, uidB, uidNew]) {
        await testDb.delete(habitLogs).where(eq(habitLogs.userId, u));
        await testDb.delete(habits).where(eq(habits.userId, u));
        await testDb.delete(studySessions).where(eq(studySessions.userId, u));
        await testDb.delete(financeTransactions).where(eq(financeTransactions.userId, u));
        await testDb.delete(goals).where(eq(goals.userId, u));
        await testDb.delete(simulationScenarios).where(eq(simulationScenarios.userId, u));
        await testDb.delete(users).where(eq(users.uid, u));
      }

      await pool.end();
    }
  });
});
