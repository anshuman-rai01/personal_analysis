/**
 * OmniLife Studio: Seed Account Service
 *
 * Safe, scoped, deterministic seeder for a single registered account.
 * Replaces old sample data with --reset in one transaction.
 * Strictly verifies zero side effects on any other user.
 */

import { db } from './index.ts';
import {
  users,
  studySessions,
  financeTransactions,
  habits,
  habitLogs,
  goals,
  simulationScenarios,
  forecastModels,
} from './schema.ts';
import { eq, ne, sql } from 'drizzle-orm';
import {
  FORECAST_MIN_ACTIVE_DAYS,
  FORECAST_RELIABLE_ACTIVE_DAYS,
} from '../modules/forecasting/thresholds.ts';
import { generateSeedData, GeneratedSeedData } from './seedGenerator.ts';

export interface SeedAccountOptions {
  email: string;
  execute?: boolean;
  reset?: boolean;
  referenceDate?: Date;
  seed?: number;
}

export interface UserTableCounts {
  studySessions: number;
  financeTransactions: number;
  habits: number;
  habitLogs: number;
  goals: number;
  simulationScenarios: number;
  forecastModels: number;
  total: number;
}

export interface ModuleActiveDaysReport {
  have: number;
  minimumRequired: number;
  reliableAt: number;
  targetWithBuffer: number;
  status: 'insufficient' | 'low_confidence' | 'reliable';
}

export interface SeedAccountResult {
  targetUser: {
    id: number;
    uid: string;
    email: string;
    displayName: string | null;
  };
  mode: 'DRY_RUN' | 'EXECUTE';
  resetApplied: boolean;
  existingCounts: UserTableCounts;
  plannedCounts: {
    studySessions: number;
    financeTransactions: number;
    habits: number;
    habitLogs: number;
    goals: number;
    total: number;
  };
  activeDaysReport: {
    study: ModuleActiveDaysReport;
    finance: ModuleActiveDaysReport;
    habits: ModuleActiveDaysReport;
  };
  financeBreakdown: {
    expenseDays: number;
    incomeDays: number;
    savingsDays: number;
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
  };
  window: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  otherUsersVerifiedUntouched: boolean;
  insertedCounts?: UserTableCounts;
}

/**
 * Counts rows in all data tables for a specific user ID.
 */
async function countUserData(uid: string, database: any): Promise<UserTableCounts> {
  const [
    studyRes,
    finRes,
    habitsRes,
    logsRes,
    goalsRes,
    simRes,
    modelsRes,
  ] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(eq(studySessions.userId, uid)),
    database.select({ count: sql<number>`count(*)::int` }).from(financeTransactions).where(eq(financeTransactions.userId, uid)),
    database.select({ count: sql<number>`count(*)::int` }).from(habits).where(eq(habits.userId, uid)),
    database.select({ count: sql<number>`count(*)::int` }).from(habitLogs).where(eq(habitLogs.userId, uid)),
    database.select({ count: sql<number>`count(*)::int` }).from(goals).where(eq(goals.userId, uid)),
    database.select({ count: sql<number>`count(*)::int` }).from(simulationScenarios).where(eq(simulationScenarios.userId, uid)),
    database.select({ count: sql<number>`count(*)::int` }).from(forecastModels).where(eq(forecastModels.userId, uid)),
  ]);

  const studySessionsCount = studyRes[0]?.count || 0;
  const financeTransactionsCount = finRes[0]?.count || 0;
  const habitsCount = habitsRes[0]?.count || 0;
  const habitLogsCount = logsRes[0]?.count || 0;
  const goalsCount = goalsRes[0]?.count || 0;
  const simulationScenariosCount = simRes[0]?.count || 0;
  const forecastModelsCount = modelsRes[0]?.count || 0;

  const total =
    studySessionsCount +
    financeTransactionsCount +
    habitsCount +
    habitLogsCount +
    goalsCount +
    simulationScenariosCount +
    forecastModelsCount;

  return {
    studySessions: studySessionsCount,
    financeTransactions: financeTransactionsCount,
    habits: habitsCount,
    habitLogs: habitLogsCount,
    goals: goalsCount,
    simulationScenarios: simulationScenariosCount,
    forecastModels: forecastModelsCount,
    total,
  };
}

/**
 * Captures aggregate row counts of all OTHER users in each data table.
 */
async function getOtherUsersTotals(targetUid: string, database: any): Promise<Record<string, number>> {
  const [
    studyRes,
    finRes,
    habitsRes,
    logsRes,
    goalsRes,
    simRes,
    modelsRes,
  ] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(ne(studySessions.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(financeTransactions).where(ne(financeTransactions.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(habits).where(ne(habits.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(habitLogs).where(ne(habitLogs.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(goals).where(ne(goals.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(simulationScenarios).where(ne(simulationScenarios.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(forecastModels).where(ne(forecastModels.userId, targetUid)),
  ]);

  return {
    studySessions: studyRes[0]?.count || 0,
    financeTransactions: finRes[0]?.count || 0,
    habits: habitsRes[0]?.count || 0,
    habitLogs: logsRes[0]?.count || 0,
    goals: goalsRes[0]?.count || 0,
    simulationScenarios: simRes[0]?.count || 0,
    forecastModels: modelsRes[0]?.count || 0,
  };
}

/**
 * Main seeding execution function.
 */
export async function seedAccount(
  options: SeedAccountOptions,
  database: any = db
): Promise<SeedAccountResult> {
  const {
    email,
    execute = false,
    reset = false,
    referenceDate = new Date(),
    seed = 847291,
  } = options;

  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('A valid --email argument must be provided.');
  }

  // Refuse to run in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed tool when NODE_ENV is "production".');
  }

  // 1. Resolve registered user from users table
  const cleanEmail = email.trim().toLowerCase();
  const allUsers = await database
    .select({
      id: users.id,
      uid: users.uid,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users);

  const matchedUsers = allUsers.filter(
    (u: { email: string }) => u.email.toLowerCase() === cleanEmail
  );

  if (matchedUsers.length === 0) {
    throw new Error(
      `User with email "${email}" was not found in the users table.\n` +
      `Please register or log in with this email in the app once, then rerun.`
    );
  }

  if (matchedUsers.length > 1) {
    const candidateList = matchedUsers
      .map((u: { id: number; uid: string; email: string }) => `  - ID: ${u.id}, UID: ${u.uid}, Email: ${u.email}`)
      .join('\n');
    throw new Error(
      `Ambiguous match: multiple user rows matched email "${email}":\n${candidateList}\n` +
      `Aborting without changes.`
    );
  }

  const targetUser = matchedUsers[0];
  const targetUid = targetUser.uid;

  // 2. Check existing row counts for target user
  const existingCounts = await countUserData(targetUid, database);

  if (existingCounts.total > 0 && !reset) {
    throw new Error(
      `Account "${targetUser.email}" already holds ${existingCounts.total} records across data tables:\n` +
      `  - study_sessions:       ${existingCounts.studySessions}\n` +
      `  - finance_transactions: ${existingCounts.financeTransactions}\n` +
      `  - habits:               ${existingCounts.habits}\n` +
      `  - habit_logs:           ${existingCounts.habitLogs}\n` +
      `  - goals:                ${existingCounts.goals}\n` +
      `  - simulation_scenarios: ${existingCounts.simulationScenarios}\n` +
      `  - forecast_models:      ${existingCounts.forecastModels}\n\n` +
      `Pass "--reset" to clear existing records for this user and seed fresh data.`
    );
  }

  // 3. Generate deterministic dataset
  const generatedData: GeneratedSeedData = generateSeedData({
    uid: targetUid,
    referenceDate,
    seed,
  });

  const plannedCounts = {
    studySessions: generatedData.studySessions.length,
    financeTransactions: generatedData.financeTransactions.length,
    habits: generatedData.habits.length,
    habitLogs: generatedData.habitLogs.length,
    goals: generatedData.goals.length,
    total:
      generatedData.studySessions.length +
      generatedData.financeTransactions.length +
      generatedData.habits.length +
      generatedData.habitLogs.length +
      generatedData.goals.length,
  };

  const minActiveDaysTarget = FORECAST_RELIABLE_ACTIVE_DAYS + 10;

  const buildModuleReport = (have: number): ModuleActiveDaysReport => {
    let status: 'insufficient' | 'low_confidence' | 'reliable' = 'insufficient';
    if (have >= FORECAST_RELIABLE_ACTIVE_DAYS) {
      status = 'reliable';
    } else if (have >= FORECAST_MIN_ACTIVE_DAYS) {
      status = 'low_confidence';
    }

    return {
      have,
      minimumRequired: FORECAST_MIN_ACTIVE_DAYS,
      reliableAt: FORECAST_RELIABLE_ACTIVE_DAYS,
      targetWithBuffer: minActiveDaysTarget,
      status,
    };
  };

  const activeDaysReport = {
    study: buildModuleReport(generatedData.metrics.studyDistinctDays),
    finance: buildModuleReport(generatedData.metrics.financeDistinctDays),
    habits: buildModuleReport(generatedData.metrics.habitCompletedDistinctDays),
  };

  const financeBreakdown = {
    expenseDays: generatedData.metrics.financeExpenseDays,
    incomeDays: generatedData.metrics.financeIncomeDays,
    savingsDays: generatedData.metrics.financeSavingsDays,
    totalIncome: generatedData.metrics.totalIncome,
    totalExpenses: generatedData.metrics.totalExpenses,
    netSavings: generatedData.metrics.netSavings,
    savingsRate: generatedData.metrics.savingsRate,
  };

  const window = {
    startDate: generatedData.startDate,
    endDate: generatedData.endDate,
    totalDays: generatedData.windowDays,
  };

  // If dry run, return preview without touching database
  if (!execute) {
    return {
      targetUser,
      mode: 'DRY_RUN',
      resetApplied: false,
      existingCounts,
      plannedCounts,
      activeDaysReport,
      financeBreakdown,
      window,
      otherUsersVerifiedUntouched: true,
    };
  }

  // 4. Capture baseline row counts of other users
  const otherUsersBaseline = await getOtherUsersTotals(targetUid, database);

  // 5. Execute in single atomic transaction
  await database.transaction(async (tx: any) => {
    // 5.1 If reset, delete all existing records for targetUid in FK-safe order
    if (reset && existingCounts.total > 0) {
      await tx.delete(habitLogs).where(eq(habitLogs.userId, targetUid));
      await tx.delete(habits).where(eq(habits.userId, targetUid));
      await tx.delete(studySessions).where(eq(studySessions.userId, targetUid));
      await tx.delete(financeTransactions).where(eq(financeTransactions.userId, targetUid));
      await tx.delete(goals).where(eq(goals.userId, targetUid));
      await tx.delete(simulationScenarios).where(eq(simulationScenarios.userId, targetUid));
      await tx.delete(forecastModels).where(eq(forecastModels.userId, targetUid));

      // Verify zero records remain for targetUid
      const preCheck = await countUserData(targetUid, tx);
      if (preCheck.total > 0) {
        throw new Error(
          `Integrity failure: ${preCheck.total} records remain for user ${targetUid} after delete.`
        );
      }
    }

    // 5.2 Insert habits and capture database-generated IDs
    const insertedHabits = await tx
      .insert(habits)
      .values(generatedData.habits)
      .returning({ id: habits.id, name: habits.name });

    // 5.3 Map habitLogs habitIndex to database IDs and insert logs
    const mappedLogs = generatedData.habitLogs.map((log) => {
      const parentHabit = insertedHabits[log.habitIndex];
      if (!parentHabit) {
        throw new Error(`Failed to map habit log at index ${log.habitIndex} to parent habit.`);
      }
      return {
        habitId: parentHabit.id,
        userId: targetUid,
        date: log.date,
        completed: log.completed,
        moodScore: log.moodScore,
        durationMinutes: log.durationMinutes,
        notes: log.notes,
      };
    });

    await tx.insert(habitLogs).values(mappedLogs);

    // 5.4 Insert study sessions
    await tx.insert(studySessions).values(generatedData.studySessions);

    // 5.5 Insert finance transactions
    await tx.insert(financeTransactions).values(generatedData.financeTransactions);

    // 5.6 Insert goals
    await tx.insert(goals).values(generatedData.goals);

    // 5.7 Verify other users were strictly untouched
    const otherUsersPost = await getOtherUsersTotals(targetUid, tx);
    for (const tableName of Object.keys(otherUsersBaseline)) {
      if (otherUsersBaseline[tableName] !== otherUsersPost[tableName]) {
        throw new Error(
          `Isolation breach: other users' row counts changed in "${tableName}" ` +
          `(before: ${otherUsersBaseline[tableName]}, after: ${otherUsersPost[tableName]}). ` +
          `Rolling back all changes!`
        );
      }
    }
  });

  // Post-transaction verification
  const insertedCounts = await countUserData(targetUid, database);

  return {
    targetUser,
    mode: 'EXECUTE',
    resetApplied: reset,
    existingCounts,
    plannedCounts,
    activeDaysReport,
    financeBreakdown,
    window,
    otherUsersVerifiedUntouched: true,
    insertedCounts,
  };
}
