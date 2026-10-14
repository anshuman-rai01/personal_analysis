import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema.ts';
import {
  users,
  studySessions,
  financeTransactions,
  habits,
  habitLogs,
} from '../../db/schema.ts';
import { getForecastReadiness } from './readiness.ts';

describe('Forecast Readiness Service Integration (PostgreSQL)', () => {
  const testDbName = process.env.SQL_DB_NAME_TEST;

  if (!testDbName) {
    it('skips database readiness test when SQL_DB_NAME_TEST is unset', (t) => {
      t.skip('SQL_DB_NAME_TEST environment variable not set.');
    });
    return;
  }

  it('proves distinct active days counting, 13 vs 14 day gate, habit completion filter, and per-user isolation', async () => {
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
    const uidA = `test_readiness_a_${ts}`;
    const emailA = `alice_${ts}@readiness.test`;
    const uidB = `test_readiness_b_${ts}`;
    const emailB = `bob_${ts}@readiness.test`;

    try {
      // Create Users
      await testDb.insert(users).values([
        { uid: uidA, email: emailA, displayName: 'Alice' },
        { uid: uidB, email: emailB, displayName: 'Bob' },
      ]);

      // 1. New User A has all 0 records and allowed=false
      const initial = await getForecastReadiness(uidA, testDb);
      assert.equal(initial.modules.study.totalRecords, 0);
      assert.equal(initial.modules.study.distinctDays, 0);
      assert.equal(initial.modules.study.allowed, false);
      assert.equal(initial.modules.study.remaining, 14);
      assert.equal(initial.modules.study.status, 'insufficient');

      assert.equal(initial.modules.finance.allowed, false);
      assert.equal(initial.modules.habits.allowed, false);

      // 2. Several records on one day count as ONE distinct day
      await testDb.insert(studySessions).values([
        { userId: uidA, subject: 'CS', topic: 'Algorithms 1', durationMinutes: 45, technique: 'Deep Work', focusScore: 8, energyScore: 8, date: '2026-10-01' },
        { userId: uidA, subject: 'CS', topic: 'Algorithms 2', durationMinutes: 60, technique: 'Deep Work', focusScore: 9, energyScore: 8, date: '2026-10-01' },
        { userId: uidA, subject: 'CS', topic: 'Algorithms 3', durationMinutes: 30, technique: 'Pomodoro', focusScore: 7, energyScore: 7, date: '2026-10-01' },
      ]);

      const multiStudy = await getForecastReadiness(uidA, testDb);
      assert.equal(multiStudy.modules.study.totalRecords, 3);
      assert.equal(multiStudy.modules.study.distinctDays, 1, '3 sessions on the same date must count as 1 distinct day');
      assert.equal(multiStudy.modules.study.remaining, 13);
      assert.equal(multiStudy.modules.study.allowed, false);

      // 3. Habits count only completed = 1
      const [habitItem] = await testDb.insert(habits).values({
        userId: uidA,
        name: 'Daily Hydration',
        category: 'Health',
        frequency: 'daily',
      }).returning();

      // 3 check-ins with completed = 1 (on distinct dates)
      // 2 check-ins with completed = 0 (on distinct dates)
      await testDb.insert(habitLogs).values([
        { habitId: habitItem.id, userId: uidA, date: '2026-10-01', completed: 1 },
        { habitId: habitItem.id, userId: uidA, date: '2026-10-02', completed: 1 },
        { habitId: habitItem.id, userId: uidA, date: '2026-10-03', completed: 1 },
        { habitId: habitItem.id, userId: uidA, date: '2026-10-04', completed: 0 }, // missed
        { habitId: habitItem.id, userId: uidA, date: '2026-10-05', completed: 0 }, // missed
      ]);

      const habitsReadiness = await getForecastReadiness(uidA, testDb);
      assert.equal(habitsReadiness.modules.habits.totalRecords, 3, 'completed=0 logs must be excluded');
      assert.equal(habitsReadiness.modules.habits.distinctDays, 3);
      assert.equal(habitsReadiness.modules.habits.remaining, 11);
      assert.equal(habitsReadiness.modules.habits.allowed, false);

      // 4. 13 vs 14 days boundary in finance
      const finRows = [];
      for (let i = 1; i <= 13; i++) {
        finRows.push({
          userId: uidA,
          title: `Expense ${i}`,
          type: 'expense',
          category: 'Food',
          amount: 50,
          paymentMethod: 'UPI',
          date: `2026-09-${String(i).padStart(2, '0')}`,
        });
      }
      await testDb.insert(financeTransactions).values(finRows);

      // Check at 13 days
      const finAt13 = await getForecastReadiness(uidA, testDb);
      assert.equal(finAt13.modules.finance.distinctDays, 13);
      assert.equal(finAt13.modules.finance.remaining, 1);
      assert.equal(finAt13.modules.finance.allowed, false);
      assert.equal(finAt13.modules.finance.status, 'insufficient');

      // Add 14th day
      await testDb.insert(financeTransactions).values({
        userId: uidA,
        title: 'Expense 14',
        type: 'expense',
        category: 'Food',
        amount: 75,
        paymentMethod: 'UPI',
        date: '2026-09-14',
      });

      const finAt14 = await getForecastReadiness(uidA, testDb);
      assert.equal(finAt14.modules.finance.distinctDays, 14);
      assert.equal(finAt14.modules.finance.remaining, 0);
      assert.equal(finAt14.modules.finance.allowed, true, 'At 14 distinct days, allowed must be true');
      assert.equal(finAt14.modules.finance.status, 'low_confidence');

      // 5. Strict per-user isolation: User B has 0 across all modules
      const readinessB = await getForecastReadiness(uidB, testDb);
      assert.equal(readinessB.modules.study.totalRecords, 0);
      assert.equal(readinessB.modules.finance.totalRecords, 0);
      assert.equal(readinessB.modules.habits.totalRecords, 0);
      assert.equal(readinessB.modules.finance.allowed, false);
      assert.equal(readinessB.modules.finance.remaining, 14);
    } finally {
      for (const u of [uidA, uidB]) {
        await testDb.delete(habitLogs).where(eq(habitLogs.userId, u));
        await testDb.delete(habits).where(eq(habits.userId, u));
        await testDb.delete(studySessions).where(eq(studySessions.userId, u));
        await testDb.delete(financeTransactions).where(eq(financeTransactions.userId, u));
        await testDb.delete(users).where(eq(users.uid, u));
      }
      await pool.end();
    }
  });
});
