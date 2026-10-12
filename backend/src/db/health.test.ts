import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getExpectedTableNames,
  findMissingTables,
  shapeHealthResponse,
  maskConnectionInfo,
  checkDatabase,
} from './health.ts';

describe('Table Presence Logic (Pure)', () => {
  const expected = [
    'finance_transactions',
    'forecast_models',
    'goals',
    'habit_logs',
    'habits',
    'simulation_scenarios',
    'study_sessions',
    'users',
  ];

  it('derives all 8 expected tables from Drizzle schema', () => {
    const tableNames = getExpectedTableNames();
    assert.deepEqual(tableNames, expected);
  });

  it('returns empty list when all 8 expected tables are present', () => {
    const missing = findMissingTables(expected);
    assert.deepEqual(missing, []);
  });

  it('returns missing table names when a subset is missing', () => {
    const existing = ['users', 'habits', 'goals'];
    const missing = findMissingTables(existing);
    assert.deepEqual(missing, [
      'finance_transactions',
      'forecast_models',
      'habit_logs',
      'simulation_scenarios',
      'study_sessions',
    ]);
  });

  it('returns all expected tables when existing tables array is empty', () => {
    const missing = findMissingTables([]);
    assert.deepEqual(missing, expected);
  });

  it('handles case-insensitive comparison correctly', () => {
    const existing = expected.map((t) => t.toUpperCase());
    const missing = findMissingTables(existing);
    assert.deepEqual(missing, []);
  });
});

describe('Health Payload Shaping (Pure)', () => {
  it('shapes healthy payload when connected with zero missing tables', () => {
    const res = shapeHealthResponse(true, []);
    assert.deepEqual(res, {
      status: 'ok',
      database: {
        connected: true,
        schema: 'ok',
        missingTables: [],
      },
    });
  });

  it('shapes degraded payload when connected but tables are missing', () => {
    const missing = ['finance_transactions', 'study_sessions'];
    const res = shapeHealthResponse(true, missing);
    assert.deepEqual(res, {
      status: 'degraded',
      database: {
        connected: true,
        schema: 'missing_tables',
        missingTables: ['finance_transactions', 'study_sessions'],
      },
    });
  });

  it('shapes degraded payload with schema unknown on connection failure', () => {
    const res = shapeHealthResponse(false, []);
    assert.deepEqual(res, {
      status: 'degraded',
      database: {
        connected: false,
        schema: 'unknown',
        missingTables: [],
      },
    });
  });

  it('ensures health payload contains only expected keys and zero credential leaks', () => {
    const res = shapeHealthResponse(false, []);
    const jsonStr = JSON.stringify(res);
    assert.equal(jsonStr.includes('password'), false);
    assert.equal(jsonStr.includes('secret'), false);
    assert.equal(jsonStr.includes('postgres'), false);
  });
});

describe('Mask Connection Info', () => {
  it('strictly masks password and preserves host, port, user', () => {
    const formatted = maskConnectionInfo({
      host: 'localhost',
      port: 5432,
      user: 'omni_user',
    });
    assert.equal(formatted, 'host=localhost, port=5432, user=omni_user, password=***');
    assert.equal(formatted.includes('***'), true);
  });
});

describe('checkDatabase with Stubbed Pool', () => {
  it('returns status ok when pool queries succeed with all tables', async () => {
    const stubPool: any = {
      async query(sql: string) {
        if (sql.includes('SELECT 1')) {
          return { rows: [{ '?column?': 1 }] };
        }
        if (sql.includes('information_schema.tables')) {
          return {
            rows: [
              { table_name: 'finance_transactions' },
              { table_name: 'forecast_models' },
              { table_name: 'goals' },
              { table_name: 'habit_logs' },
              { table_name: 'habits' },
              { table_name: 'simulation_scenarios' },
              { table_name: 'study_sessions' },
              { table_name: 'users' },
            ],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    };

    const res = await checkDatabase(stubPool);
    assert.equal(res.status, 'ok');
    assert.equal(res.database.connected, true);
    assert.equal(res.database.schema, 'ok');
    assert.deepEqual(res.database.missingTables, []);
  });

  it('returns degraded with missing_tables when some tables are absent', async () => {
    const stubPool: any = {
      async query(sql: string) {
        if (sql.includes('SELECT 1')) return { rows: [] };
        if (sql.includes('information_schema.tables')) {
          return {
            rows: [{ table_name: 'users' }],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    };

    const res = await checkDatabase(stubPool);
    assert.equal(res.status, 'degraded');
    assert.equal(res.database.connected, true);
    assert.equal(res.database.schema, 'missing_tables');
    assert.ok(res.database.missingTables.includes('finance_transactions'));
  });

  it('returns degraded with unknown schema when pool throws connection error', async () => {
    const stubPool: any = {
      async query() {
        const err: any = new Error('connect ECONNREFUSED 127.0.0.1:5432');
        err.code = 'ECONNREFUSED';
        throw err;
      },
    };

    const res = await checkDatabase(stubPool);
    assert.equal(res.status, 'degraded');
    assert.equal(res.database.connected, false);
    assert.equal(res.database.schema, 'unknown');
  });
});
