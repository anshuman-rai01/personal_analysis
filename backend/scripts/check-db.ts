import * as dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import { validateDbEnv } from '../src/db/envCheck.ts';
import {
  getExpectedTableNames,
  findMissingTables,
  maskConnectionInfo,
} from '../src/db/health.ts';

dotenv.config();
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });

async function main() {
  console.log('==================================================');
  console.log('OmniLife Studio: Database Status & Health Check');
  console.log('==================================================');

  const envProblems = validateDbEnv(process.env);
  if (envProblems.length > 0) {
    console.warn('\n[db:check] Environment configuration warnings:');
    for (const problem of envProblems) {
      console.warn(`  - ${problem}`);
    }
    console.warn('');
  }

  const host = process.env.SQL_HOST || 'localhost';
  const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
  const dbName = process.env.SQL_DB_NAME || 'omnilife';
  const user = process.env.SQL_USER || 'postgres';
  const password = process.env.SQL_PASSWORD || '';

  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database: dbName,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log(`Connection: ${maskConnectionInfo({ host, port, user })}`);
    console.log(`Target Database: ${dbName}`);
    console.log('Status: Connected\n');
  } catch (err: any) {
    console.error(`\n[db:check] Database connection failed:`);
    console.error(`  Connection: ${maskConnectionInfo({ host, port, user })}`);
    console.error(`  Database:   ${dbName}`);
    console.error(`  Error:      ${err.code || 'UNKNOWN'} (${err.message})`);
    console.error('\nRun "npm run db:setup" to configure and verify your database.');
    process.exit(1);
  }

  const expectedTables = getExpectedTableNames();
  let existingTables: string[] = [];

  try {
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    existingTables = res.rows.map((r) => r.table_name);

    console.log(
      '%-25s %-12s %-10s'.replace('%-25s', 'Table Name'.padEnd(25))
        .replace('%-12s', 'Status'.padEnd(12))
        .replace('%-10s', 'Row Count')
    );
    console.log('--------------------------------------------------');

    let totalRows = 0;
    const existingSet = new Set(existingTables.map((t) => t.toLowerCase()));

    for (const table of expectedTables) {
      const isPresent = existingSet.has(table.toLowerCase());
      if (isPresent) {
        try {
          const countRes = await client.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM "${table}"`
          );
          const count = countRes.rows[0]?.count || 0;
          totalRows += count;
          console.log(
            `${table.padEnd(25)} ${'Present'.padEnd(12)} ${count}`
          );
        } catch (_countErr) {
          console.log(
            `${table.padEnd(25)} ${'Present'.padEnd(12)} [Error reading rows]`
          );
        }
      } else {
        console.log(
          `${table.padEnd(25)} ${'MISSING'.padEnd(12)} -`
        );
      }
    }

    console.log('--------------------------------------------------');
    const missing = findMissingTables(existingTables, expectedTables);
    const presentCount = expectedTables.length - missing.length;
    console.log(`Tables: ${presentCount} / ${expectedTables.length} present`);
    console.log(`Total Rows: ${totalRows}`);
    console.log('==================================================');

    // Identity Class Breakdown
    if (existingSet.has('users')) {
      console.log('\n==================================================');
      console.log('Identity Class Breakdown');
      console.log('==================================================');
      console.log(
        '%-12s %-14s %-14s'.replace('%-12s', 'Class'.padEnd(12))
          .replace('%-14s', 'Users Count'.padEnd(14))
          .replace('%-14s', 'Total Records')
      );
      console.log('--------------------------------------------------');

      const classes: Array<'firebase' | 'guest_' | 'usr_' | 'demo_' | 'default'> = [
        'firebase',
        'guest_',
        'usr_',
        'demo_',
        'default',
      ];

      const userCountsByClass: Record<string, number> = {
        firebase: 0,
        guest_: 0,
        usr_: 0,
        demo_: 0,
        default: 0,
      };

      const dataCountsByClass: Record<string, number> = {
        firebase: 0,
        guest_: 0,
        usr_: 0,
        demo_: 0,
        default: 0,
      };

      // Query users grouped by class
      const userRes = await client.query<{ id_class: string; count: number }>(`
        SELECT 
          CASE 
            WHEN uid = 'default_user_101' THEN 'default'
            WHEN uid LIKE 'guest_%' THEN 'guest_'
            WHEN uid LIKE 'usr_%' THEN 'usr_'
            WHEN uid LIKE 'demo_%' THEN 'demo_'
            ELSE 'firebase'
          END AS id_class,
          count(*)::int AS count
        FROM users
        GROUP BY 1
      `);

      for (const row of userRes.rows) {
        if (row.id_class in userCountsByClass) {
          userCountsByClass[row.id_class] = row.count;
        }
      }

      // Query data tables for user_id distribution
      const dataTablesWithUserId = [
        'study_sessions',
        'finance_transactions',
        'habits',
        'habit_logs',
        'goals',
        'simulation_scenarios',
        'forecast_models',
      ];

      for (const table of dataTablesWithUserId) {
        if (existingSet.has(table)) {
          try {
            const tableRes = await client.query<{ id_class: string; count: number }>(`
              SELECT 
                CASE 
                  WHEN user_id = 'default_user_101' THEN 'default'
                  WHEN user_id LIKE 'guest_%' THEN 'guest_'
                  WHEN user_id LIKE 'usr_%' THEN 'usr_'
                  WHEN user_id LIKE 'demo_%' THEN 'demo_'
                  ELSE 'firebase'
                END AS id_class,
                count(*)::int AS count
              FROM "${table}"
              GROUP BY 1
            `);

            for (const row of tableRes.rows) {
              if (row.id_class in dataCountsByClass) {
                dataCountsByClass[row.id_class] += row.count;
              }
            }
          } catch (_e) {
            // ignore table query error
          }
        }
      }

      for (const cls of classes) {
        console.log(
          `${cls.padEnd(12)} ${String(userCountsByClass[cls]).padEnd(14)} ${dataCountsByClass[cls] + userCountsByClass[cls]}`
        );
      }
      console.log('--------------------------------------------------');

      // Warn if usr_ accounts exist
      if (userCountsByClass['usr_'] > 0) {
        console.warn('\n> [WARNING] "usr_" accounts were created by the local-account fallback.');
        console.warn('> They must be checked before purging in case one belonged to a real person.');
        try {
          const usrList = await client.query<{ email: string; uid: string }>(
            `SELECT email, uid FROM users WHERE uid LIKE 'usr_%'`
          );
          for (const u of usrList.rows) {
            console.warn(`  - Email: ${u.email} (UID: ${u.uid})`);
          }
        } catch (_e) {
          // ignore
        }
      }
      console.log('==================================================\n');
    }

    if (missing.length > 0) {
      console.error(
        `\n[db:check] Action required: Missing tables: ${missing.join(', ')}`
      );
      console.error('Run "npm run db:setup" to create missing tables.\n');
      process.exit(1);
    } else {
      console.log('All expected schema tables are present and verified.\n');
      process.exit(0);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:check] Unexpected error:', err);
  process.exit(1);
});
