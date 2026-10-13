import * as dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import { spawn } from 'node:child_process';
import { validateDbEnv } from '../src/db/envCheck.ts';
import {
  getExpectedTableNames,
  findMissingTables,
  maskConnectionInfo,
} from '../src/db/health.ts';

dotenv.config();
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });

// Escape hatch: DB_SETUP_SKIP=true exits 0 immediately
if (process.env.DB_SETUP_SKIP === 'true') {
  console.log('[db:setup] DB_SETUP_SKIP=true is set; skipping database setup.');
  process.exit(0);
}

function printConnectionError(
  err: any,
  host: string,
  port: number,
  user: string,
  targetDb: string
) {
  console.error(`\n[db:setup] Failed to connect to PostgreSQL (${targetDb}):`);
  console.error(`  Connection: ${maskConnectionInfo({ host, port, user })}`);
  console.error(`  Error class / code: ${err.code || 'UNKNOWN'} (${err.message})`);
  console.error('\nLikely fixes:');
  if (err.code === 'ECONNREFUSED') {
    console.error(`  - Is PostgreSQL running on ${host}:${port}? Ensure the PostgreSQL service is started.`);
    console.error('  - If using Docker: check that your PostgreSQL container is running.');
  } else if (err.code === '28P01') {
    console.error(`  - Wrong password for user "${user}".`);
    console.error('  - Update SQL_ADMIN_PASSWORD or SQL_PASSWORD with the correct password in your .env file.');
  } else if (err.code === '28000') {
    console.error(`  - Authentication failure for user "${user}".`);
    console.error('  - Check PostgreSQL pg_hba.conf configuration and user privileges.');
  } else if (err.code === 'ENOTFOUND') {
    console.error(`  - Host "${host}" could not be resolved. Check SQL_HOST in .env.`);
  } else {
    console.error('  - Verify PostgreSQL is running and accepting connections.');
    console.error('  - Verify connection variables in your .env file.');
    console.error('  - Check pg_hba.conf permissions.');
  }
}

async function runDrizzlePush(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[db:setup] Running "drizzle-kit push" to apply schema non-destructively...');
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(cmd, ['drizzle-kit', 'push'], {
      stdio: 'inherit',
      env: { ...process.env },
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`drizzle-kit push exited with code ${code}`));
      }
    });

    child.on('error', (err) => reject(err));
  });
}

async function main() {
  console.log('==================================================');
  console.log('OmniLife Studio: Database Bootstrap & Setup');
  console.log('==================================================');

  // 1. Run validateDbEnv; on problems print them and exit 1
  const envProblems = validateDbEnv(process.env);
  if (envProblems.length > 0) {
    console.error('\n[db:setup] Configuration problems detected in environment:');
    for (const problem of envProblems) {
      console.error(`  - ${problem}`);
    }
    console.error(
      '\nPlease edit your .env file to provide real PostgreSQL credentials before running setup.'
    );
    process.exit(1);
  }

  const host = process.env.SQL_HOST || 'localhost';
  const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
  const dbName = process.env.SQL_DB_NAME || 'omnilife';
  const adminUser = process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'postgres';
  const adminPassword =
    process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '';
  const appUser = process.env.SQL_USER || 'postgres';
  const appPassword = process.env.SQL_PASSWORD || '';

  // Validate database name against ^[A-Za-z0-9_]+$
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    console.error(
      `[db:setup] Invalid database name: "${dbName}". Must contain only alphanumeric characters and underscores.`
    );
    process.exit(1);
  }

  // 2. Connect to maintenance database 'postgres' with admin credentials
  const maintenanceClient = new pg.Client({
    host,
    port,
    user: adminUser,
    password: adminPassword,
    database: 'postgres',
    connectionTimeoutMillis: 10000,
  });

  try {
    await maintenanceClient.connect();
  } catch (err: any) {
    printConnectionError(err, host, port, adminUser, 'maintenance database postgres');
    process.exit(1);
  }

  let dbCreated = false;

  try {
    // 3. If SQL_DB_NAME does not exist, CREATE DATABASE it
    const dbCheckRes = await maintenanceClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (dbCheckRes.rows.length === 0) {
      console.log(`[db:setup] Database "${dbName}" does not exist. Creating...`);
      // Identifier is quoted safely
      const quotedDbName = `"${dbName.replace(/"/g, '""')}"`;
      await maintenanceClient.query(`CREATE DATABASE ${quotedDbName}`);
      console.log(`[db:setup] Database "${dbName}" created successfully.`);
      dbCreated = true;
    } else {
      console.log(`[db:setup] Database "${dbName}" exists.`);
    }
  } finally {
    await maintenanceClient.end();
  }

  // 4. Connect to SQL_DB_NAME and check which of the 8 expected tables exist
  let appClient = new pg.Client({
    host,
    port,
    user: appUser,
    password: appPassword,
    database: dbName,
    connectionTimeoutMillis: 10000,
  });

  try {
    await appClient.connect();
  } catch (err: any) {
    // If connection as appUser failed, try connecting with admin user
    if (adminUser !== appUser) {
      try {
        appClient = new pg.Client({
          host,
          port,
          user: adminUser,
          password: adminPassword,
          database: dbName,
          connectionTimeoutMillis: 10000,
        });
        await appClient.connect();
      } catch (adminErr: any) {
        printConnectionError(adminErr, host, port, adminUser, dbName);
        process.exit(1);
      }
    } else {
      printConnectionError(err, host, port, appUser, dbName);
      process.exit(1);
    }
  }

  const expectedTables = getExpectedTableNames();
  let existingTables: string[] = [];

  try {
    const tablesRes = await appClient.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    existingTables = tablesRes.rows.map((r) => r.table_name);
  } finally {
    await appClient.end();
  }

  let missingTables = findMissingTables(existingTables, expectedTables);

  // 5. Only if tables are missing, run drizzle-kit push
  let tablesCreatedList: string[] = [];
  if (missingTables.length === 0) {
    console.log('[db:setup] Schema already in place. All tables present.');
  } else {
    console.log(
      `[db:setup] Missing tables detected: ${missingTables.join(', ')}`
    );
    await runDrizzlePush();

    // Re-check tables
    const verifyClient = new pg.Client({
      host,
      port,
      user: appUser,
      password: appPassword,
      database: dbName,
      connectionTimeoutMillis: 10000,
    });

    try {
      await verifyClient.connect();
      const verifyRes = await verifyClient.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );
      existingTables = verifyRes.rows.map((r) => r.table_name);
    } finally {
      await verifyClient.end();
    }

    const remainingMissing = findMissingTables(existingTables, expectedTables);
    if (remainingMissing.length > 0) {
      console.error(
        `[db:setup] ERROR: Tables still missing after schema push: ${remainingMissing.join(', ')}`
      );
      process.exit(1);
    }

    tablesCreatedList = missingTables;
    console.log('[db:setup] Schema push completed successfully.');
  }

  // 6. Print short summary
  console.log('\n==================================================');
  console.log('Setup Summary:');
  console.log(`  Database Created:   ${dbCreated ? 'Yes' : 'No (Already existed)'}`);
  console.log(
    `  Tables Created:     ${tablesCreatedList.length > 0 ? tablesCreatedList.join(', ') : 'None (Schema already in place)'}`
  );
  console.log(`  Final Table List:   ${existingTables.sort().join(', ')}`);
  console.log('==================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('[db:setup] Unexpected fatal error:', err);
  process.exit(1);
});
