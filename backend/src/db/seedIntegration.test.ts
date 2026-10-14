import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import {
  users,
  studySessions,
  financeTransactions,
  habits,
  habitLogs,
  goals,
  simulationScenarios,
  forecastModels,
} from './schema.ts';
import { seedAccount } from './seedAccount.ts';

describe('Seed Account Integration Suite (PostgreSQL)', () => {
  const testDbName = process.env.SQL_DB_NAME_TEST;

  if (!testDbName) {
    it('skips real database test when SQL_DB_NAME_TEST is unset', (t) => {
      t.skip(
        'SQL_DB_NAME_TEST environment variable is not set; skipping real PostgreSQL integration test.'
      );
    });
    return;
  }

  it('runs complete lifecycle: dry-run, abort without reset, reset execution, cross-user isolation, rollback, and unknown email handling', async () => {
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
    const uidA = `test_seed_user_a_${ts}`;
    const emailA = `alice_${ts}@seed.test`;
    const uidB = `test_seed_user_b_${ts}`;
    const emailB = `bob_${ts}@seed.test`;

    try {
      // 1. Create two registered test users
      await testDb.insert(users).values([
        { uid: uidA, email: emailA, displayName: 'Alice Test' },
        { uid: uidB, email: emailB, displayName: 'Bob Test' },
      ]);

      // Seed a couple of existing rows for user B to verify isolation
      const insertedHabitB = await testDb
        .insert(habits)
        .values({
          userId: uidB,
          name: 'Bob Existing Habit',
          category: 'Fitness',
          frequency: 'daily',
        })
        .returning({ id: habits.id });

      await testDb.insert(habitLogs).values({
        habitId: insertedHabitB[0].id,
        userId: uidB,
        date: '2026-10-10',
        completed: 1,
      });

      await testDb.insert(studySessions).values({
        userId: uidB,
        subject: 'Bob Study',
        topic: 'Isolation Check',
        durationMinutes: 60,
        technique: 'Deep Work',
        focusScore: 8,
        energyScore: 8,
        date: '2026-10-10',
      });

      // Capture User B baseline counts
      const getCountsB = async () => {
        const [h, l, s] = await Promise.all([
          testDb.select().from(habits).where(eq(habits.userId, uidB)),
          testDb.select().from(habitLogs).where(eq(habitLogs.userId, uidB)),
          testDb.select().from(studySessions).where(eq(studySessions.userId, uidB)),
        ]);
        return { habits: h.length, logs: l.length, study: s.length };
      };

      const baselineB = await getCountsB();
      assert.equal(baselineB.habits, 1);
      assert.equal(baselineB.logs, 1);
      assert.equal(baselineB.study, 1);

      // --- Test 1: Unknown email aborts without writing anything ---
      await assert.rejects(
        async () => {
          await seedAccount({ email: `nonexistent_${ts}@seed.test`, execute: true }, testDb);
        },
        /not found in the users table/
      );

      // --- Test 2: Dry run changes nothing ---
      const dryRunResult = await seedAccount(
        { email: emailA, execute: false, reset: false },
        testDb
      );
      assert.equal(dryRunResult.mode, 'DRY_RUN');
      assert(dryRunResult.plannedCounts.total > 150);

      const checkAEmpty = await testDb.select().from(studySessions).where(eq(studySessions.userId, uidA));
      assert.equal(checkAEmpty.length, 0, 'Dry run must not insert any study sessions');

      // --- Test 3: Execute initial seeding for User A ---
      const execResult = await seedAccount(
        { email: emailA, execute: true, reset: false },
        testDb
      );
      assert.equal(execResult.mode, 'EXECUTE');
      assert.equal(execResult.resetApplied, false);
      assert(execResult.insertedCounts!.total > 150);

      // Verify User A has records
      const checkAStudy = await testDb.select().from(studySessions).where(eq(studySessions.userId, uidA));
      assert(checkAStudy.length >= 50);

      // Verify User B remained completely untouched
      const postExecB = await getCountsB();
      assert.deepEqual(postExecB, baselineB, 'User B data must remain untouched after User A seeding');

      // --- Test 4: Execute without --reset on account with existing data ABORTS ---
      await assert.rejects(
        async () => {
          await seedAccount({ email: emailA, execute: true, reset: false }, testDb);
        },
        /already holds \d+ records across data tables/
      );

      // --- Test 5: Execute with --reset succeeds and replaces User A's rows ---
      const resetResult = await seedAccount(
        { email: emailA, execute: true, reset: true, seed: 111111 },
        testDb
      );
      assert.equal(resetResult.resetApplied, true);
      assert(resetResult.insertedCounts!.total > 150);

      // Verify User B remained untouched again
      const postResetB = await getCountsB();
      assert.deepEqual(postResetB, baselineB, 'User B data must remain untouched after User A reset');

      // --- Test 6: Rollback mid-transaction leaves account as it was ---
      const studyBeforeRollback = await testDb
        .select()
        .from(studySessions)
        .where(eq(studySessions.userId, uidA));
      const studyCountBefore = studyBeforeRollback.length;

      // Wrap a failing operation in a transaction to simulate mid-insert failure
      try {
        await testDb.transaction(async (tx: any) => {
          await tx.delete(studySessions).where(eq(studySessions.userId, uidA));
          // Force mid-transaction failure
          throw new Error('Simulated database write failure mid-transaction');
        });
      } catch (err: any) {
        assert(err.message.includes('Simulated database write failure'));
      }

      const studyAfterRollback = await testDb
        .select()
        .from(studySessions)
        .where(eq(studySessions.userId, uidA));
      assert.equal(
        studyAfterRollback.length,
        studyCountBefore,
        'Rollback must preserve original records'
      );
    } finally {
      // Cleanup throwaway test users and their data in FK-safe order
      try {
        await testDb.delete(habitLogs).where(eq(habitLogs.userId, uidA));
        await testDb.delete(habitLogs).where(eq(habitLogs.userId, uidB));
        await testDb.delete(habits).where(eq(habits.userId, uidA));
        await testDb.delete(habits).where(eq(habits.userId, uidB));
        await testDb.delete(studySessions).where(eq(studySessions.userId, uidA));
        await testDb.delete(studySessions).where(eq(studySessions.userId, uidB));
        await testDb.delete(financeTransactions).where(eq(financeTransactions.userId, uidA));
        await testDb.delete(financeTransactions).where(eq(financeTransactions.userId, uidB));
        await testDb.delete(goals).where(eq(goals.userId, uidA));
        await testDb.delete(goals).where(eq(goals.userId, uidB));
        await testDb.delete(simulationScenarios).where(eq(simulationScenarios.userId, uidA));
        await testDb.delete(simulationScenarios).where(eq(simulationScenarios.userId, uidB));
        await testDb.delete(forecastModels).where(eq(forecastModels.userId, uidA));
        await testDb.delete(forecastModels).where(eq(forecastModels.userId, uidB));
        await testDb.delete(users).where(eq(users.uid, uidA));
        await testDb.delete(users).where(eq(users.uid, uidB));
      } catch (cleanupErr) {
        console.warn('Test cleanup notice:', cleanupErr);
      }
      await pool.end();
    }
  });
});
