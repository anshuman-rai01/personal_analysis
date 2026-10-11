import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import { studySessions, financeTransactions } from './schema.ts';

describe('PostgreSQL Database Integration (Optional)', () => {
  const testDbName = process.env.SQL_DB_NAME_TEST;

  if (!testDbName) {
    it('skips real database test when SQL_DB_NAME_TEST is unset', (t) => {
      t.skip(
        'SQL_DB_NAME_TEST environment variable is not set; skipping real PostgreSQL integration test.'
      );
    });
    return;
  }

  it('creates, lists, and cleans up records against real PostgreSQL database', async () => {
    const pool = new Pool({
      host: process.env.SQL_HOST || 'localhost',
      port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD,
      database: testDbName,
      connectionTimeoutMillis: 5000,
    });

    const testDb = drizzle(pool, { schema });
    const throwawayUserId = `test_runner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Create a study session
      const insertedStudy = await testDb
        .insert(studySessions)
        .values({
          userId: throwawayUserId,
          subject: 'Integration Testing',
          topic: 'Postgres Validation',
          durationMinutes: 45,
          technique: 'Deep Work',
          focusScore: 9,
          energyScore: 8,
          date: '2026-10-11',
          notes: 'Automated test suite entry',
        })
        .returning();

      assert.equal(insertedStudy.length, 1);
      assert.equal(insertedStudy[0].userId, throwawayUserId);

      // 2. Create a finance transaction
      const insertedFinance = await testDb
        .insert(financeTransactions)
        .values({
          userId: throwawayUserId,
          title: 'Integration Test Expense',
          type: 'expense',
          category: 'Tech',
          amount: 25.5,
          paymentMethod: 'Credit Card',
          date: '2026-10-11',
          notes: 'Automated test suite expense',
        })
        .returning();

      assert.equal(insertedFinance.length, 1);
      assert.equal(insertedFinance[0].userId, throwawayUserId);

      // 3. List and verify both exist
      const fetchedStudy = await testDb
        .select()
        .from(studySessions)
        .where(eq(studySessions.userId, throwawayUserId));
      assert.equal(fetchedStudy.length, 1);
      assert.equal(fetchedStudy[0].id, insertedStudy[0].id);

      const fetchedFinance = await testDb
        .select()
        .from(financeTransactions)
        .where(eq(financeTransactions.userId, throwawayUserId));
      assert.equal(fetchedFinance.length, 1);
      assert.equal(fetchedFinance[0].id, insertedFinance[0].id);

      // 4. Delete both records
      await testDb
        .delete(studySessions)
        .where(eq(studySessions.userId, throwawayUserId));
      await testDb
        .delete(financeTransactions)
        .where(eq(financeTransactions.userId, throwawayUserId));

      // 5. Verify cleanup
      const postStudy = await testDb
        .select()
        .from(studySessions)
        .where(eq(studySessions.userId, throwawayUserId));
      assert.equal(postStudy.length, 0);

      const postFinance = await testDb
        .select()
        .from(financeTransactions)
        .where(eq(financeTransactions.userId, throwawayUserId));
      assert.equal(postFinance.length, 0);
    } finally {
      await pool.end();
    }
  });
});
