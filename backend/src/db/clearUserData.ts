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
import { eq, sql } from 'drizzle-orm';

export interface ClearUserDataOptions {
  email?: string;
  uid?: string;
  execute?: boolean;
  deleteUser?: boolean;
}

export interface UserDataCounts {
  habitLogs: number;
  habits: number;
  studySessions: number;
  financeTransactions: number;
  goals: number;
  simulationScenarios: number;
  forecastModels: number;
  users?: number;
}

export interface ClearUserDataResult {
  targetUser: {
    id: number;
    uid: string;
    email: string;
    displayName: string | null;
  };
  counts: UserDataCounts;
  executed: boolean;
  deletedUser: boolean;
}

/**
 * Counts and optionally clears all tracked activity records for a specific registered user.
 * Operates within a single transaction in FK-safe order when execute is true.
 * Verifies zero rows remain before committing.
 *
 * @param options Target selection (email or uid) and execution flags
 * @param database Injected drizzle instance (defaults to production db)
 */
export async function clearUserData(
  options: ClearUserDataOptions,
  database: any = db
): Promise<ClearUserDataResult> {
  const { email, uid, execute = false, deleteUser = false } = options;

  if (!email && !uid) {
    throw new Error('Either --email or --uid must be provided.');
  }

  // 1. Locate the target user
  let matchedUsers: Array<{
    id: number;
    uid: string;
    email: string;
    displayName: string | null;
  }> = [];

  if (uid) {
    matchedUsers = await database
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
  } else if (email) {
    const allUsers = await database
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users);

    matchedUsers = allUsers.filter(
      (u: { email: string }) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
  }

  if (matchedUsers.length === 0) {
    throw new Error(
      `User not found in users table matching ${uid ? `UID "${uid}"` : `email "${email}"`}.`
    );
  }

  const target = matchedUsers[0];
  const targetUid = target.uid;

  // 2. Count current rows for this user in all data tables
  const [
    logsCountRes,
    habitsCountRes,
    studyCountRes,
    finCountRes,
    goalsCountRes,
    simCountRes,
    modelsCountRes,
  ] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(habitLogs).where(eq(habitLogs.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(habits).where(eq(habits.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(eq(studySessions.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(financeTransactions).where(eq(financeTransactions.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(goals).where(eq(goals.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(simulationScenarios).where(eq(simulationScenarios.userId, targetUid)),
    database.select({ count: sql<number>`count(*)::int` }).from(forecastModels).where(eq(forecastModels.userId, targetUid)),
  ]);

  const counts: UserDataCounts = {
    habitLogs: logsCountRes[0]?.count || 0,
    habits: habitsCountRes[0]?.count || 0,
    studySessions: studyCountRes[0]?.count || 0,
    financeTransactions: finCountRes[0]?.count || 0,
    goals: goalsCountRes[0]?.count || 0,
    simulationScenarios: simCountRes[0]?.count || 0,
    forecastModels: modelsCountRes[0]?.count || 0,
    users: deleteUser ? 1 : 0,
  };

  // 3. If execute is true, delete inside a transaction in FK-safe order
  if (execute) {
    await database.transaction(async (tx: any) => {
      // 1. habit_logs (FK references habits.id)
      await tx.delete(habitLogs).where(eq(habitLogs.userId, targetUid));
      // 2. habits
      await tx.delete(habits).where(eq(habits.userId, targetUid));
      // 3. study_sessions
      await tx.delete(studySessions).where(eq(studySessions.userId, targetUid));
      // 4. finance_transactions
      await tx.delete(financeTransactions).where(eq(financeTransactions.userId, targetUid));
      // 5. goals
      await tx.delete(goals).where(eq(goals.userId, targetUid));
      // 6. simulation_scenarios
      await tx.delete(simulationScenarios).where(eq(simulationScenarios.userId, targetUid));
      // 7. forecast_models
      await tx.delete(forecastModels).where(eq(forecastModels.userId, targetUid));

      // 8. Optional user row deletion
      if (deleteUser) {
        await tx.delete(users).where(eq(users.uid, targetUid));
      }

      // Verification: verify zero records remain for this user
      const [
        checkLogs,
        checkHabits,
        checkStudy,
        checkFin,
        checkGoals,
        checkSim,
        checkModels,
      ] = await Promise.all([
        tx.select({ count: sql<number>`count(*)::int` }).from(habitLogs).where(eq(habitLogs.userId, targetUid)),
        tx.select({ count: sql<number>`count(*)::int` }).from(habits).where(eq(habits.userId, targetUid)),
        tx.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(eq(studySessions.userId, targetUid)),
        tx.select({ count: sql<number>`count(*)::int` }).from(financeTransactions).where(eq(financeTransactions.userId, targetUid)),
        tx.select({ count: sql<number>`count(*)::int` }).from(goals).where(eq(goals.userId, targetUid)),
        tx.select({ count: sql<number>`count(*)::int` }).from(simulationScenarios).where(eq(simulationScenarios.userId, targetUid)),
        tx.select({ count: sql<number>`count(*)::int` }).from(forecastModels).where(eq(forecastModels.userId, targetUid)),
      ]);

      const remainingDataRows =
        (checkLogs[0]?.count || 0) +
        (checkHabits[0]?.count || 0) +
        (checkStudy[0]?.count || 0) +
        (checkFin[0]?.count || 0) +
        (checkGoals[0]?.count || 0) +
        (checkSim[0]?.count || 0) +
        (checkModels[0]?.count || 0);

      if (remainingDataRows > 0) {
        throw new Error(
          `Integrity verification failed: ${remainingDataRows} data rows remain for user "${targetUid}" after deletion.`
        );
      }

      if (deleteUser) {
        const checkUser = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.uid, targetUid));
        if ((checkUser[0]?.count || 0) > 0) {
          throw new Error(
            `Integrity verification failed: user row still exists for UID "${targetUid}" after deleteUser.`
          );
        }
      }
    });
  }

  return {
    targetUser: target,
    counts,
    executed: !!execute,
    deletedUser: !!(execute && deleteUser),
  };
}
