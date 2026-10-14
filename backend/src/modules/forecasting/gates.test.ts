import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema.ts';
import {
  users,
  studySessions,
  forecastModels,
} from '../../db/schema.ts';
import { apiRouter } from '../../routes/index.ts';
import { setTokenVerifier, resetTokenVerifier } from '../../middleware/auth.ts';
import { setPythonRunner, resetPythonRunner } from './forecasting.routes.ts';
import { setSimulationRunner, resetSimulationRunner } from '../simulation/simulation.routes.ts';

describe('Forecasting & Simulation Route Gates (HTTP 422 & 400)', () => {
  const testDbName = process.env.SQL_DB_NAME_TEST;

  if (!testDbName) {
    it('skips route gating tests when SQL_DB_NAME_TEST is unset', (t) => {
      t.skip('SQL_DB_NAME_TEST environment variable not set.');
    });
    return;
  }

  it('proves 400 on unknown types, 422 on insufficient data without starting Python, 422 on 5-row CSV, and passes at 14 days', async () => {
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
    const uidEmpty = `gate_empty_${ts}`;
    const emailEmpty = `empty_${ts}@gates.test`;
    const uidReady = `gate_ready_${ts}`;
    const emailReady = `ready_${ts}@gates.test`;

    // Track Python execution to prove it is NEVER started when gate rejects
    let pythonTrainCalls = 0;
    let pythonSimCalls = 0;

    setPythonRunner(async (_args: string[]) => {
      pythonTrainCalls++;
      return {
        stdout: JSON.stringify({
          r2_score: 0.88,
          mae: 1.2,
          mse: 2.1,
          features: ['f1', 'f2'],
          record_count: 1400,
          feature_importances: {},
          forecast_series: [],
        }),
        stderr: '',
      };
    });

    setSimulationRunner(async (_args: string[]) => {
      pythonSimCalls++;
      return {
        stdout: JSON.stringify({
          scenario: 'study_career',
          projectedGrowth: 45.5,
          risk: 'low',
        }),
        stderr: '',
      };
    });

    // Ephemeral express server
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    const server = app.listen(0);
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    setTokenVerifier(async (token: string) => {
      if (token === 'token_empty') {
        return { uid: uidEmpty, email: emailEmpty } as any;
      }
      if (token === 'token_ready') {
        return { uid: uidReady, email: emailReady } as any;
      }
      const err: any = new Error('Invalid token');
      err.code = 'auth/argument-error';
      throw err;
    });

    try {
      // 1. Register both users in DB
      await testDb.insert(users).values([
        { uid: uidEmpty, email: emailEmpty, displayName: 'Empty User' },
        { uid: uidReady, email: emailReady, displayName: 'Ready User' },
      ]);

      // Seed 14 distinct study days for Ready User
      const studyRows = [];
      for (let i = 1; i <= 14; i++) {
        studyRows.push({
          userId: uidReady,
          subject: 'AI Alignment',
          topic: `Safety ${i}`,
          durationMinutes: 60,
          technique: 'Deep Work',
          focusScore: 9,
          energyScore: 8,
          date: `2026-09-${String(i).padStart(2, '0')}`,
        });
      }
      await testDb.insert(studySessions).values(studyRows);

      // --- Gate Verification 1: Unknown datasetType returns 400 ---
      const resBadDataset = await fetch(`${baseUrl}/api/ml/train`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_empty',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetType: 'crypto_astrology' }),
      });
      assert.equal(resBadDataset.status, 400);
      assert.equal(pythonTrainCalls, 0, 'Python must not be called on 400');

      // --- Gate Verification 2: Unknown scenarioType returns 400 ---
      const resBadScenario = await fetch(`${baseUrl}/api/simulation/run`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_empty',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenarioType: 'unknown_scenario' }),
      });
      assert.equal(resBadScenario.status, 400);
      assert.equal(pythonSimCalls, 0, 'Python must not be called on 400');

      // --- Gate Verification 3: Empty user /ml/train returns 422 INSUFFICIENT_DATA without starting Python ---
      const resTrainEmpty = await fetch(`${baseUrl}/api/ml/train`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_empty',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetType: 'study' }),
      });
      assert.equal(resTrainEmpty.status, 422);
      const jsonTrainEmpty = await resTrainEmpty.json();
      assert.equal(jsonTrainEmpty.code, 'INSUFFICIENT_DATA');
      assert.equal(jsonTrainEmpty.module, 'study');
      assert.equal(jsonTrainEmpty.source, 'tracked');
      assert.equal(jsonTrainEmpty.have, 0);
      assert.equal(jsonTrainEmpty.required, 14);
      assert.equal(jsonTrainEmpty.remaining, 14);
      assert.equal(pythonTrainCalls, 0, 'Python must NOT be started for user with insufficient data');

      // --- Gate Verification 4: Empty user /simulation/run returns 422 without starting Python ---
      const resSimEmpty = await fetch(`${baseUrl}/api/simulation/run`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_empty',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenarioType: 'study_career' }),
      });
      assert.equal(resSimEmpty.status, 422);
      const jsonSimEmpty = await resSimEmpty.json();
      assert.equal(jsonSimEmpty.code, 'INSUFFICIENT_DATA');
      assert.equal(jsonSimEmpty.module, 'study');
      assert.equal(pythonSimCalls, 0, 'Python must NOT be started for user with insufficient data');

      // --- Gate Verification 5: 5-row CSV returns 422 INSUFFICIENT_DATA without starting Python ---
      const csv5Rows = [
        'date,hours,focus',
        '2026-10-01,1,7',
        '2026-10-02,2,8',
        '2026-10-03,3,9',
        '2026-10-04,1,6',
        '2026-10-05,2,8',
      ].join('\r\n');

      const resTrainCsv5 = await fetch(`${baseUrl}/api/ml/train`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_empty',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasetType: 'study',
          customCsvContent: csv5Rows,
        }),
      });
      assert.equal(resTrainCsv5.status, 422);
      const jsonTrainCsv5 = await resTrainCsv5.json();
      assert.equal(jsonTrainCsv5.code, 'INSUFFICIENT_DATA');
      assert.equal(jsonTrainCsv5.source, 'csv');
      assert.equal(jsonTrainCsv5.have, 5);
      assert.equal(jsonTrainCsv5.required, 14);
      assert.equal(jsonTrainCsv5.remaining, 9);
      assert.equal(pythonTrainCalls, 0, 'Python must not start for 5-row CSV');

      // --- Gate Verification 6: 14-row CSV passes gate and trains ---
      const csv14RowsArr = ['date,hours,focus'];
      for (let i = 1; i <= 14; i++) {
        csv14RowsArr.push(`2026-10-${String(i).padStart(2, '0')},2,8`);
      }
      const csv14Rows = csv14RowsArr.join('\r\n');

      const resTrainCsv14 = await fetch(`${baseUrl}/api/ml/train`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_empty',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasetType: 'study',
          customCsvContent: csv14Rows,
        }),
      });
      assert.equal(resTrainCsv14.status, 200, '14-row CSV must pass gate and train');
      assert.equal(pythonTrainCalls, 1, 'Python must be executed for valid 14-row CSV');

      // --- Gate Verification 7: User with 14 active days passes tracked history gate ---
      const resTrainReady = await fetch(`${baseUrl}/api/ml/train`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_ready',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetType: 'study' }),
      });
      assert.equal(resTrainReady.status, 200, 'User with 14 tracked days must pass training gate');
      assert.equal(pythonTrainCalls, 2);

      // --- Gate Verification 8: User with 14 active days passes simulation gate ---
      const resSimReady = await fetch(`${baseUrl}/api/simulation/run`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token_ready',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioType: 'study_career',
          params: { studyHoursWeek: 25 },
        }),
      });
      assert.equal(resSimReady.status, 200, 'User with 14 tracked days must pass simulation gate');
      assert.equal(pythonSimCalls, 1);

      // --- Gate Verification 9: GET /forecasting/readiness returns contract ---
      const resReadiness = await fetch(`${baseUrl}/api/forecasting/readiness`, {
        headers: { Authorization: 'Bearer token_ready' },
      });
      assert.equal(resReadiness.status, 200);
      const jsonReadiness = await resReadiness.json();
      assert.equal(jsonReadiness.thresholds.minActiveDays, 14);
      assert.equal(jsonReadiness.thresholds.reliableActiveDays, 28);
      assert.equal(jsonReadiness.modules.study.allowed, true);
      assert.equal(jsonReadiness.modules.study.distinctDays, 14);
      assert.equal(jsonReadiness.modules.finance.allowed, false);
      assert.equal(jsonReadiness.modules.finance.distinctDays, 0);
    } finally {
      resetPythonRunner();
      resetSimulationRunner();
      resetTokenVerifier();
      server.close();

      for (const u of [uidEmpty, uidReady]) {
        await testDb.delete(studySessions).where(eq(studySessions.userId, u));
        await testDb.delete(forecastModels).where(eq(forecastModels.userId, u));
        await testDb.delete(users).where(eq(users.uid, u));
      }
      await pool.end();
    }
  });
});
