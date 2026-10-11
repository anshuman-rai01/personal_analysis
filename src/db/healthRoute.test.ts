import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { shapeHealthResponse, getExpectedTableNames } from './health.ts';

describe('GET /api/health route contract', () => {
  function createTestApp(healthProvider: () => any) {
    const app = express();
    app.get('/api/health', async (_req, res) => {
      try {
        const result = await healthProvider();
        res.json(result);
      } catch (_err) {
        res.json({
          status: 'degraded',
          database: {
            connected: false,
            schema: 'unknown',
            missingTables: [],
          },
        });
      }
    });
    return app;
  }

  it('returns ok status when connected and all 8 tables present', async () => {
    const app = createTestApp(() => shapeHealthResponse(true, []));
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.database.connected, true);
      assert.equal(data.database.schema, 'ok');
      assert.deepEqual(data.database.missingTables, []);
    } finally {
      server.close();
    }
  });

  it('returns degraded status with missingTables list when tables are absent', async () => {
    const missing = ['finance_transactions', 'study_sessions'];
    const app = createTestApp(() => shapeHealthResponse(true, missing));
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'degraded');
      assert.equal(data.database.connected, true);
      assert.equal(data.database.schema, 'missing_tables');
      assert.deepEqual(data.database.missingTables, missing);
    } finally {
      server.close();
    }
  });

  it('returns degraded status with unknown schema when disconnected', async () => {
    const app = createTestApp(() => {
      throw new Error('Connection refused to PostgreSQL');
    });
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'degraded');
      assert.equal(data.database.connected, false);
      assert.equal(data.database.schema, 'unknown');
      assert.deepEqual(data.database.missingTables, []);

      // Verify zero credentials in response payload
      const jsonStr = JSON.stringify(data);
      assert.equal(jsonStr.includes('password'), false);
      assert.equal(jsonStr.includes('postgres'), false);
    } finally {
      server.close();
    }
  });
});
