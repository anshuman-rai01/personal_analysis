import { is, getTableName } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';
import * as schema from './schema.ts';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: {
    connected: boolean;
    schema: 'ok' | 'missing_tables' | 'unknown';
    missingTables: string[];
  };
}

/**
 * Derives the list of expected database table names dynamically from the Drizzle schema exports.
 */
export function getExpectedTableNames(): string[] {
  const tableNames: string[] = [];
  for (const item of Object.values(schema)) {
    if (is(item, PgTable)) {
      tableNames.push(getTableName(item));
    }
  }
  return [...new Set(tableNames)].sort();
}

/**
 * Pure function comparing existing table names to expected table names.
 * Returns an array of missing table names in alphabetical order.
 */
export function findMissingTables(
  existingTables: string[],
  expectedTables: string[] = getExpectedTableNames()
): string[] {
  const existingSet = new Set(existingTables.map((t) => t.toLowerCase()));
  return expectedTables
    .filter((table) => !existingSet.has(table.toLowerCase()))
    .sort();
}

/**
 * Pure function shaping the health response payload.
 * Guarantee: Never includes credentials, connection strings, or raw error objects.
 */
export function shapeHealthResponse(
  connected: boolean,
  missingTables: string[]
): HealthResponse {
  if (!connected) {
    return {
      status: 'degraded',
      database: {
        connected: false,
        schema: 'unknown',
        missingTables: [],
      },
    };
  }

  if (missingTables.length > 0) {
    return {
      status: 'degraded',
      database: {
        connected: true,
        schema: 'missing_tables',
        missingTables,
      },
    };
  }

  return {
    status: 'ok',
    database: {
      connected: true,
      schema: 'ok',
      missingTables: [],
    },
  };
}

/**
 * Formats database connection parameters for logging with the password strictly masked.
 */
export function maskConnectionInfo(info: {
  host?: string;
  port?: number | string;
  user?: string;
}): string {
  const host = info.host || 'localhost';
  const port = info.port || 5432;
  const user = info.user || 'postgres';
  return `host=${host}, port=${port}, user=${user}, password=***`;
}

// In-memory 5-second health check cache
let cachedHealthResult: HealthResponse | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 5000;

/**
 * Non-mutating database health check against a pg Pool or Client.
 * Runs `SELECT 1` and queries `information_schema.tables` for missing tables.
 */
export async function checkDatabase(pool: Pool): Promise<HealthResponse> {
  try {
    // 1. Connectivity test
    await pool.query('SELECT 1');

    // 2. Table presence check
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );

    const existingTables = result.rows.map((r) => r.table_name);
    const missingTables = findMissingTables(existingTables);

    return shapeHealthResponse(true, missingTables);
  } catch (_err) {
    return shapeHealthResponse(false, []);
  }
}

/**
 * Returns cached health check result if within TTL (5s), otherwise queries database.
 */
export async function getCachedHealth(
  pool: Pool,
  forceRefresh = false
): Promise<HealthResponse> {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedHealthResult &&
    now - lastCheckTime < CACHE_TTL_MS
  ) {
    return cachedHealthResult;
  }

  cachedHealthResult = await checkDatabase(pool);
  lastCheckTime = now;
  return cachedHealthResult;
}

/**
 * Clears the health cache (useful for test isolation).
 */
export function clearHealthCache(): void {
  cachedHealthResult = null;
  lastCheckTime = 0;
}
