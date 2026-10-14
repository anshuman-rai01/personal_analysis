import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
} from './schema.ts';
import {
  clearUserData,
} from './clearUserData.ts';
import {
  purgeLegacyData,
  classifyIdentity,
  isLegacyIdentity,
} from './purgeLegacy.ts';

describe('Database Cleanup & Purge Suite', () => {
  describe('Identity Classification (Pure Unit Tests)', () => {
    it('classifies default_user_101 as default and legacy', () => {
      assert.equal(classifyIdentity('default_user_101'), 'default');
      assert.equal(isLegacyIdentity('default_user_101'), true);
    });

    it('classifies guest_ prefixes as guest_ and legacy', () => {
      assert.equal(classifyIdentity('guest_12345'), 'guest_');
      assert.equal(isLegacyIdentity('guest_12345'), true);
    });

    it('classifies usr_ prefixes as usr_ and legacy', () => {
      assert.equal(classifyIdentity('usr_YW5zaHVtYW5y'), 'usr_');
      assert.equal(isLegacyIdentity('usr_YW5zaHVtYW5y'), true);
    });

    it('classifies demo_ prefixes as demo_ and legacy', () => {
      assert.equal(classifyIdentity('demo_alex_sharma'), 'demo_');
      assert.equal(isLegacyIdentity('demo_alex_sharma'), true);
    });

    it('classifies genuine Firebase UIDs as firebase and non-legacy', () => {
      assert.equal(classifyIdentity('kL3x98ZqP0wN2mR4vT1y'), 'firebase');
      assert.equal(isLegacyIdentity('kL3x98ZqP0wN2mR4vT1y'), false);
    });
  });

  describe('PostgreSQL Data Cleanup Integration', () => {
    const testDbName = process.env.SQL_DB_NAME_TEST;

    if (!testDbName) {
      it('skips PostgreSQL integration when SQL_DB_NAME_TEST is unset', (t) => {
        t.skip('SQL_DB_NAME_TEST environment variable not set.');
      });
      return;
    }

    it('proves dry run changes nothing, --execute clears target, and other user data is untouched', async () => {
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
      const uidA = `test_user_a_${ts}`;
      const emailA = `usera_${ts}@test.omnilife`;
      const uidB = `test_user_b_${ts}`;
      const emailB = `userb_${ts}@test.omnilife`;

      try {
        // 1. Create User A and User B
        await testDb.insert(users).values([
          { uid: uidA, email: emailA, displayName: 'Test User A' },
          { uid: uidB, email: emailB, displayName: 'Test User B' },
        ]);

        // Insert records for User A
        const [habitA] = await testDb.insert(habits).values({
          userId: uidA,
          name: 'Morning Meditation',
          category: 'Mindfulness',
          frequency: 'daily',
        }).returning();

        await testDb.insert(habitLogs).values([
          { habitId: habitA.id, userId: uidA, date: '2026-10-10', completed: 1 },
          { habitId: habitA.id, userId: uidA, date: '2026-10-11', completed: 1 },
        ]);

        await testDb.insert(studySessions).values([
          { userId: uidA, subject: 'Physics', topic: 'Thermodynamics', durationMinutes: 60, technique: 'Deep Work', focusScore: 8, energyScore: 8, date: '2026-10-10' },
          { userId: uidA, subject: 'Math', topic: 'Calculus', durationMinutes: 45, technique: 'Pomodoro', focusScore: 9, energyScore: 7, date: '2026-10-11' },
        ]);

        await testDb.insert(financeTransactions).values([
          { userId: uidA, title: 'Salary', type: 'income', category: 'Salary', amount: 5000, paymentMethod: 'Bank Transfer', date: '2026-10-01' },
          { userId: uidA, title: 'Groceries', type: 'expense', category: 'Food', amount: 120, paymentMethod: 'Credit Card', date: '2026-10-10' },
        ]);

        await testDb.insert(goals).values({
          userId: uidA,
          title: 'Master Calculus',
          module: 'study',
          targetValue: 50,
          currentValue: 10,
          unit: 'Hours',
          deadline: '2026-12-31',
        });

        // Insert records for User B
        const [habitB] = await testDb.insert(habits).values({
          userId: uidB,
          name: 'Evening Jog',
          category: 'Fitness',
          frequency: 'daily',
        }).returning();

        await testDb.insert(habitLogs).values({
          habitId: habitB.id, userId: uidB, date: '2026-10-10', completed: 1,
        });

        await testDb.insert(studySessions).values({
          userId: uidB, subject: 'Chemistry', topic: 'Organic', durationMinutes: 50, technique: 'Deep Work', focusScore: 7, energyScore: 7, date: '2026-10-10',
        });

        await testDb.insert(financeTransactions).values({
          userId: uidB, title: 'Books', type: 'expense', category: 'Education', amount: 45, paymentMethod: 'UPI', date: '2026-10-10',
        });

        await testDb.insert(goals).values({
          userId: uidB,
          title: 'Read 10 Papers',
          module: 'study',
          targetValue: 10,
          currentValue: 2,
          unit: 'Chapters',
          deadline: '2026-11-30',
        });

        // 2. Test Dry Run on User A
        const dryRun = await clearUserData({ email: emailA, execute: false }, testDb);
        assert.equal(dryRun.executed, false);
        assert.equal(dryRun.counts.habitLogs, 2);
        assert.equal(dryRun.counts.habits, 1);
        assert.equal(dryRun.counts.studySessions, 2);
        assert.equal(dryRun.counts.financeTransactions, 2);
        assert.equal(dryRun.counts.goals, 1);

        // Verify database was NOT changed
        const verifyLogsDry = await testDb.select().from(habitLogs).where(eq(habitLogs.userId, uidA));
        assert.equal(verifyLogsDry.length, 2, 'Dry run must not delete habit logs');

        // 3. Test Execute on User A (keep user row)
        const execRun = await clearUserData({ email: emailA, execute: true, deleteUser: false }, testDb);
        assert.equal(execRun.executed, true);
        assert.equal(execRun.deletedUser, false);

        // Verify User A data is 0
        const postLogsA = await testDb.select().from(habitLogs).where(eq(habitLogs.userId, uidA));
        const postHabitsA = await testDb.select().from(habits).where(eq(habits.userId, uidA));
        const postStudyA = await testDb.select().from(studySessions).where(eq(studySessions.userId, uidA));
        const postFinA = await testDb.select().from(financeTransactions).where(eq(financeTransactions.userId, uidA));
        const postGoalsA = await testDb.select().from(goals).where(eq(goals.userId, uidA));
        const postUserA = await testDb.select().from(users).where(eq(users.uid, uidA));

        assert.equal(postLogsA.length, 0);
        assert.equal(postHabitsA.length, 0);
        assert.equal(postStudyA.length, 0);
        assert.equal(postFinA.length, 0);
        assert.equal(postGoalsA.length, 0);
        assert.equal(postUserA.length, 1, 'User row must be kept when deleteUser is false');

        // 4. Verify User B is completely untouched!
        const postLogsB = await testDb.select().from(habitLogs).where(eq(habitLogs.userId, uidB));
        const postHabitsB = await testDb.select().from(habits).where(eq(habits.userId, uidB));
        const postStudyB = await testDb.select().from(studySessions).where(eq(studySessions.userId, uidB));
        const postFinB = await testDb.select().from(financeTransactions).where(eq(financeTransactions.userId, uidB));
        const postGoalsB = await testDb.select().from(goals).where(eq(goals.userId, uidB));

        assert.equal(postLogsB.length, 1, "User B's habit logs must be untouched");
        assert.equal(postHabitsB.length, 1, "User B's habits must be untouched");
        assert.equal(postStudyB.length, 1, "User B's study sessions must be untouched");
        assert.equal(postFinB.length, 1, "User B's finance transactions must be untouched");
        assert.equal(postGoalsB.length, 1, "User B's goals must be untouched");

        // 5. Test deleteUser: true for User A
        await clearUserData({ uid: uidA, execute: true, deleteUser: true }, testDb);
        const userAAfterDelete = await testDb.select().from(users).where(eq(users.uid, uidA));
        assert.equal(userAAfterDelete.length, 0, 'User row must be deleted when deleteUser is true');
      } finally {
        // Cleanup User A and B
        await testDb.delete(habitLogs).where(eq(habitLogs.userId, uidA));
        await testDb.delete(habits).where(eq(habits.userId, uidA));
        await testDb.delete(studySessions).where(eq(studySessions.userId, uidA));
        await testDb.delete(financeTransactions).where(eq(financeTransactions.userId, uidA));
        await testDb.delete(goals).where(eq(goals.userId, uidA));
        await testDb.delete(users).where(eq(users.uid, uidA));

        await testDb.delete(habitLogs).where(eq(habitLogs.userId, uidB));
        await testDb.delete(habits).where(eq(habits.userId, uidB));
        await testDb.delete(studySessions).where(eq(studySessions.userId, uidB));
        await testDb.delete(financeTransactions).where(eq(financeTransactions.userId, uidB));
        await testDb.delete(goals).where(eq(goals.userId, uidB));
        await testDb.delete(users).where(eq(users.uid, uidB));

        await pool.end();
      }
    });
  });
});
