import { db } from './index.ts';
import {
  users,
  habitLogs,
  habits,
  studySessions,
  financeTransactions,
  goals,
  simulationScenarios,
  forecastModels,
} from './schema.ts';
import { eq, or, like, sql } from 'drizzle-orm';

export type IdentityClass = 'default' | 'guest_' | 'usr_' | 'demo_' | 'firebase';

export function classifyIdentity(uid: string): IdentityClass {
  if (uid === 'default_user_101') return 'default';
  if (uid.startsWith('guest_')) return 'guest_';
  if (uid.startsWith('usr_')) return 'usr_';
  if (uid.startsWith('demo_')) return 'demo_';
  return 'firebase';
}

export function isLegacyIdentity(uid: string): boolean {
  return (
    uid === 'default_user_101' ||
    uid.startsWith('guest_') ||
    uid.startsWith('usr_') ||
    uid.startsWith('demo_')
  );
}

export interface PurgeLegacyOptions {
  execute?: boolean;
}

export interface LegacyCounts {
  users: number;
  habitLogs: number;
  habits: number;
  studySessions: number;
  financeTransactions: number;
  goals: number;
  simulationScenarios: number;
  forecastModels: number;
}

export interface PurgeLegacyResult {
  counts: LegacyCounts;
  legacyUsers: Array<{
    id: number;
    uid: string;
    email: string;
    displayName: string | null;
    identityClass: IdentityClass;
  }>;
  executed: boolean;
}

function buildLegacyCondition(column: any) {
  return or(
    eq(column, 'default_user_101'),
    like(column, 'guest_%'),
    like(column, 'usr_%'),
    like(column, 'demo_%')
  );
}

/**
 * Counts and optionally purges legacy identities (default_user_101, guest_*, usr_*, demo_*).
 * These identities stem from removed guest/demo and local-account fallback modes.
 *
 * @param options Execution flag (execute: true to delete, false for dry run)
 * @param database Injected drizzle instance (defaults to production db)
 */
export async function purgeLegacyData(
  options: PurgeLegacyOptions = {},
  database: any = db
): Promise<PurgeLegacyResult> {
  const { execute = false } = options;

  // 1. Locate all legacy user rows
  const allUsers = await database
    .select({
      id: users.id,
      uid: users.uid,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .where(buildLegacyCondition(users.uid));

  const legacyUsers = allUsers.map((u: any) => ({
    ...u,
    identityClass: classifyIdentity(u.uid),
  }));

  // 2. Count rows in all tables matching legacy criteria
  const [
    userCountRes,
    logsCountRes,
    habitsCountRes,
    studyCountRes,
    finCountRes,
    goalsCountRes,
    simCountRes,
    modelsCountRes,
  ] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(users).where(buildLegacyCondition(users.uid)),
    database.select({ count: sql<number>`count(*)::int` }).from(habitLogs).where(buildLegacyCondition(habitLogs.userId)),
    database.select({ count: sql<number>`count(*)::int` }).from(habits).where(buildLegacyCondition(habits.userId)),
    database.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(buildLegacyCondition(studySessions.userId)),
    database.select({ count: sql<number>`count(*)::int` }).from(financeTransactions).where(buildLegacyCondition(financeTransactions.userId)),
    database.select({ count: sql<number>`count(*)::int` }).from(goals).where(buildLegacyCondition(goals.userId)),
    database.select({ count: sql<number>`count(*)::int` }).from(simulationScenarios).where(buildLegacyCondition(simulationScenarios.userId)),
    database.select({ count: sql<number>`count(*)::int` }).from(forecastModels).where(buildLegacyCondition(forecastModels.userId)),
  ]);

  const counts: LegacyCounts = {
    users: userCountRes[0]?.count || 0,
    habitLogs: logsCountRes[0]?.count || 0,
    habits: habitsCountRes[0]?.count || 0,
    studySessions: studyCountRes[0]?.count || 0,
    financeTransactions: finCountRes[0]?.count || 0,
    goals: goalsCountRes[0]?.count || 0,
    simulationScenarios: simCountRes[0]?.count || 0,
    forecastModels: modelsCountRes[0]?.count || 0,
  };

  // 3. If execute is true, delete in FK-safe order inside one transaction
  if (execute) {
    await database.transaction(async (tx: any) => {
      // 1. habit_logs (references habits)
      await tx.delete(habitLogs).where(buildLegacyCondition(habitLogs.userId));
      // 2. habits
      await tx.delete(habits).where(buildLegacyCondition(habits.userId));
      // 3. study_sessions
      await tx.delete(studySessions).where(buildLegacyCondition(studySessions.userId));
      // 4. finance_transactions
      await tx.delete(financeTransactions).where(buildLegacyCondition(financeTransactions.userId));
      // 5. goals
      await tx.delete(goals).where(buildLegacyCondition(goals.userId));
      // 6. simulation_scenarios
      await tx.delete(simulationScenarios).where(buildLegacyCondition(simulationScenarios.userId));
      // 7. forecast_models
      await tx.delete(forecastModels).where(buildLegacyCondition(forecastModels.userId));
      // 8. users
      await tx.delete(users).where(buildLegacyCondition(users.uid));

      // Verification: verify 0 legacy rows remain across all 8 tables
      const [
        checkUsers,
        checkLogs,
        checkHabits,
        checkStudy,
        checkFin,
        checkGoals,
        checkSim,
        checkModels,
      ] = await Promise.all([
        tx.select({ count: sql<number>`count(*)::int` }).from(users).where(buildLegacyCondition(users.uid)),
        tx.select({ count: sql<number>`count(*)::int` }).from(habitLogs).where(buildLegacyCondition(habitLogs.userId)),
        tx.select({ count: sql<number>`count(*)::int` }).from(habits).where(buildLegacyCondition(habits.userId)),
        tx.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(buildLegacyCondition(studySessions.userId)),
        tx.select({ count: sql<number>`count(*)::int` }).from(financeTransactions).where(buildLegacyCondition(financeTransactions.userId)),
        tx.select({ count: sql<number>`count(*)::int` }).from(goals).where(buildLegacyCondition(goals.userId)),
        tx.select({ count: sql<number>`count(*)::int` }).from(simulationScenarios).where(buildLegacyCondition(simulationScenarios.userId)),
        tx.select({ count: sql<number>`count(*)::int` }).from(forecastModels).where(buildLegacyCondition(forecastModels.userId)),
      ]);

      const remainingLegacyRows =
        (checkUsers[0]?.count || 0) +
        (checkLogs[0]?.count || 0) +
        (checkHabits[0]?.count || 0) +
        (checkStudy[0]?.count || 0) +
        (checkFin[0]?.count || 0) +
        (checkGoals[0]?.count || 0) +
        (checkSim[0]?.count || 0) +
        (checkModels[0]?.count || 0);

      if (remainingLegacyRows > 0) {
        throw new Error(
          `Integrity verification failed: ${remainingLegacyRows} legacy records remain after purge.`
        );
      }
    });
  }

  return {
    counts,
    legacyUsers,
    executed: !!execute,
  };
}
