import { db } from '../../db/index.ts';
import {
  studySessions,
  financeTransactions,
  habitLogs,
} from '../../db/schema.ts';
import { eq, and } from 'drizzle-orm';
import {
  FORECAST_MIN_ACTIVE_DAYS,
  FORECAST_RELIABLE_ACTIVE_DAYS,
  FORECAST_MIN_CSV_ROWS,
  evaluateActiveDays,
  ForecastReadinessStatus,
} from './thresholds.ts';

export interface ModuleReadiness {
  totalRecords: number;
  distinctDays: number;
  required: number;
  reliableAt: number;
  remaining: number;
  status: ForecastReadinessStatus;
  allowed: boolean;
}

export interface ForecastReadinessResult {
  thresholds: {
    minActiveDays: number;
    reliableActiveDays: number;
    minCsvRows: number;
  };
  modules: {
    study: ModuleReadiness;
    finance: ModuleReadiness;
    habits: ModuleReadiness;
  };
}

/**
 * Calculates forecasting & simulation readiness metrics for a user across study, finance, and habits.
 * All queries are strictly user-scoped. Habit check-ins count only when completed = 1.
 *
 * @param uid User ID
 * @param database Optional injected database instance (defaults to production db)
 */
export async function getForecastReadiness(
  uid: string,
  database: any = db
): Promise<ForecastReadinessResult> {
  const [studyRows, financeRows, habitRows] = await Promise.all([
    database
      .select({ date: studySessions.date })
      .from(studySessions)
      .where(eq(studySessions.userId, uid)),
    database
      .select({ date: financeTransactions.date })
      .from(financeTransactions)
      .where(eq(financeTransactions.userId, uid)),
    database
      .select({ date: habitLogs.date })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, uid), eq(habitLogs.completed, 1))),
  ]);

  const studyDays = new Set(studyRows.map((r: { date: string }) => r.date)).size;
  const evalStudy = evaluateActiveDays(studyDays);

  const financeDays = new Set(financeRows.map((r: { date: string }) => r.date)).size;
  const evalFinance = evaluateActiveDays(financeDays);

  const habitDays = new Set(habitRows.map((r: { date: string }) => r.date)).size;
  const evalHabits = evaluateActiveDays(habitDays);

  return {
    thresholds: {
      minActiveDays: FORECAST_MIN_ACTIVE_DAYS,
      reliableActiveDays: FORECAST_RELIABLE_ACTIVE_DAYS,
      minCsvRows: FORECAST_MIN_CSV_ROWS,
    },
    modules: {
      study: {
        totalRecords: studyRows.length,
        distinctDays: studyDays,
        required: FORECAST_MIN_ACTIVE_DAYS,
        reliableAt: FORECAST_RELIABLE_ACTIVE_DAYS,
        remaining: evalStudy.remaining,
        status: evalStudy.status,
        allowed: evalStudy.allowed,
      },
      finance: {
        totalRecords: financeRows.length,
        distinctDays: financeDays,
        required: FORECAST_MIN_ACTIVE_DAYS,
        reliableAt: FORECAST_RELIABLE_ACTIVE_DAYS,
        remaining: evalFinance.remaining,
        status: evalFinance.status,
        allowed: evalFinance.allowed,
      },
      habits: {
        totalRecords: habitRows.length,
        distinctDays: habitDays,
        required: FORECAST_MIN_ACTIVE_DAYS,
        reliableAt: FORECAST_RELIABLE_ACTIVE_DAYS,
        remaining: evalHabits.remaining,
        status: evalHabits.status,
        allowed: evalHabits.allowed,
      },
    },
  };
}
