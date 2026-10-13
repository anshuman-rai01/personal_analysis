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
