import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSeedData,
  formatLocalDate,
  computeStreaksFromDates,
} from './seedGenerator.ts';
import {
  FORECAST_MIN_ACTIVE_DAYS,
  FORECAST_RELIABLE_ACTIVE_DAYS,
} from '../modules/forecasting/thresholds.ts';

describe('Seed Generator Suite (Deterministic Pure Logic)', () => {
  const testUid = 'user_test_generator_123';
  const fixedRefDate = new Date('2026-10-14T12:00:00Z');

  it('is strictly deterministic: identical seed produces identical output', () => {
    const run1 = generateSeedData({ uid: testUid, referenceDate: fixedRefDate, seed: 99999 });
    const run2 = generateSeedData({ uid: testUid, referenceDate: fixedRefDate, seed: 99999 });

    assert.deepEqual(run1, run2);
  });

  it('produces no future dates and covers consecutive calendar days', () => {
    const data = generateSeedData({ uid: testUid, referenceDate: fixedRefDate });
    const todayStr = formatLocalDate(fixedRefDate);

    for (const s of data.studySessions) {
      assert(s.date <= todayStr, `Study date ${s.date} is in the future (today: ${todayStr})`);
    }
    for (const f of data.financeTransactions) {
      assert(f.date <= todayStr, `Finance date ${f.date} is in the future (today: ${todayStr})`);
    }
    for (const h of data.habitLogs) {
      assert(h.date <= todayStr, `Habit log date ${h.date} is in the future (today: ${todayStr})`);
    }

    assert.equal(data.endDate, todayStr);
    assert.equal(data.windowDays, Math.max(45, FORECAST_RELIABLE_ACTIVE_DAYS + 17));
  });

  it('satisfies all active days thresholds for prediction features unlock', () => {
    const data = generateSeedData({ uid: testUid, referenceDate: fixedRefDate });
    const minTarget = FORECAST_RELIABLE_ACTIVE_DAYS + 10; // 38 days

    // Study
    assert(
      data.metrics.studyDistinctDays >= minTarget,
      `Study active days (${data.metrics.studyDistinctDays}) must be >= ${minTarget}`
    );
    assert(
      data.metrics.studyDistinctDays >= Math.floor(data.windowDays * 0.8),
      `Study active days must be at least 80% of window`
    );
    assert(
      data.metrics.studySessionsCount >= 50 && data.metrics.studySessionsCount <= 75,
      `Study sessions (${data.metrics.studySessionsCount}) must be in 50-75`
    );

    // Finance
    assert(
      data.metrics.financeDistinctDays >= minTarget,
      `Finance distinct days (${data.metrics.financeDistinctDays}) must be >= ${minTarget}`
    );
    assert(
      data.metrics.financeExpenseDays >= 35,
      `Expense days (${data.metrics.financeExpenseDays}) must be >= 35`
    );
    assert(
      data.metrics.financeIncomeDays >= 18,
      `Income days (${data.metrics.financeIncomeDays}) must be >= 18`
    );
    assert(
      data.metrics.financeSavingsDays >= 16,
      `Savings/investment days (${data.metrics.financeSavingsDays}) must be >= 16`
    );
    assert(
      data.metrics.financeTransactionsCount >= 150 && data.metrics.financeTransactionsCount <= 200,
      `Finance transactions (${data.metrics.financeTransactionsCount}) must be in 150-200`
    );

    // Habits
    assert(
      data.metrics.habitCompletedDistinctDays >= minTarget,
      `Habit completed days (${data.metrics.habitCompletedDistinctDays}) must be >= ${minTarget}`
    );
    assert(
      data.habits.length >= 5 && data.habits.length <= 6,
      `Habits count (${data.habits.length}) must be in 5-6`
    );
  });

  it('enforces allowed enums, score ranges, integer durations, and positive amounts', () => {
    const data = generateSeedData({ uid: testUid, referenceDate: fixedRefDate });

    // Study
    const allowedTechniques = new Set(['Deep Work', 'Pomodoro', 'Active Recall', 'Feynman Method']);
    for (const s of data.studySessions) {
      assert(allowedTechniques.has(s.technique), `Invalid technique: ${s.technique}`);
      assert(s.focusScore >= 1 && s.focusScore <= 10, `Focus score ${s.focusScore} out of range 1-10`);
      assert(s.energyScore >= 1 && s.energyScore <= 10, `Energy score ${s.energyScore} out of range 1-10`);
      assert(Number.isInteger(s.durationMinutes), `Duration ${s.durationMinutes} must be integer`);
      assert(s.durationMinutes >= 25 && s.durationMinutes <= 180, `Duration ${s.durationMinutes} not in 25-180`);
    }

    // Finance
    const allowedTypes = new Set(['income', 'expense', 'investment', 'savings']);
    const allowedMethods = new Set(['Bank Transfer', 'Credit Card', 'Debit Card', 'Cash', 'Crypto']);
    const allowedCategories = new Set([
      'Food',
      'Housing',
      'Education',
      'Tech',
      'Salary',
      'Investment',
      'Savings',
      'Transport',
      'Health',
      'General',
    ]);

    for (const f of data.financeTransactions) {
      assert(allowedTypes.has(f.type), `Invalid type: ${f.type}`);
      assert(allowedMethods.has(f.paymentMethod), `Invalid paymentMethod: ${f.paymentMethod}`);
      assert(allowedCategories.has(f.category), `Invalid category: ${f.category}`);
      assert(f.amount > 0, `Amount ${f.amount} must be positive`);
      assert.equal(
        Math.round(f.amount * 100),
        Math.round(f.amount * 100),
        `Amount ${f.amount} should have at most 2 decimal places`
      );
    }

    // Habit Logs
    for (const l of data.habitLogs) {
      assert(l.completed === 0 || l.completed === 1, `Completed ${l.completed} must be 0 or 1`);
      assert(l.moodScore >= 1 && l.moodScore <= 5, `Mood score ${l.moodScore} must be 1-5`);
      assert(Number.isInteger(l.durationMinutes), `Duration must be integer`);
      assert(l.habitIndex >= 0 && l.habitIndex < data.habits.length, `Invalid habitIndex: ${l.habitIndex}`);
    }
  });

  it('enforces financial health: positive net savings and balanced categories', () => {
    const data = generateSeedData({ uid: testUid, referenceDate: fixedRefDate });

    // Net savings must never be negative
    assert(data.metrics.netSavings > 0, `Net savings (${data.metrics.netSavings}) must be > 0`);
    assert(
      data.metrics.savingsRate >= 15 && data.metrics.savingsRate <= 40,
      `Savings rate (${data.metrics.savingsRate}%) must be between 15% and 40%`
    );

    // No single category > 45% of total expenses
    const categoryTotals = new Map<string, number>();
    for (const f of data.financeTransactions) {
      if (f.type === 'expense') {
        categoryTotals.set(f.category, (categoryTotals.get(f.category) || 0) + f.amount);
      }
    }

    for (const [category, amount] of categoryTotals.entries()) {
      const share = amount / data.metrics.totalExpenses;
      assert(
        share <= 0.45,
        `Expense category "${category}" share (${Math.round(share * 100)}%) exceeds 45% threshold`
      );
    }
  });

  it('ensures habit streak fields strictly match the generated logs', () => {
    const data = generateSeedData({ uid: testUid, referenceDate: fixedRefDate });
    const todayStr = formatLocalDate(fixedRefDate);

    for (let hIdx = 0; hIdx < data.habits.length; hIdx++) {
      const habit = data.habits[hIdx];
      const completedDates = data.habitLogs
        .filter((l) => l.habitIndex === hIdx && l.completed === 1)
        .map((l) => l.date);

      const expected = computeStreaksFromDates(completedDates, todayStr);
      assert.equal(
        habit.currentStreak,
        expected.currentStreak,
        `Habit "${habit.name}" currentStreak (${habit.currentStreak}) must match logs (${expected.currentStreak})`
      );
      assert.equal(
        habit.longestStreak,
        expected.longestStreak,
        `Habit "${habit.name}" longestStreak (${habit.longestStreak}) must match logs (${expected.longestStreak})`
      );
    }
  });

  it('ensures goal currentValues strictly match seeded data and deadlines are in future', () => {
    const data = generateSeedData({ uid: testUid, referenceDate: fixedRefDate });
    const todayStr = formatLocalDate(fixedRefDate);

    assert(data.goals.length >= 4 && data.goals.length <= 5, 'Goals count must be 4-5');

    let achievedCount = 0;
    for (const g of data.goals) {
      assert(g.deadline > todayStr, `Goal deadline (${g.deadline}) must be in the future`);
      assert(g.currentValue <= g.targetValue, `currentValue (${g.currentValue}) must be <= targetValue (${g.targetValue})`);

      // Check milestones JSON
      const parsedMilestones = JSON.parse(g.milestones);
      assert(Array.isArray(parsedMilestones) && parsedMilestones.length > 0, 'Milestones must be non-empty array');
      for (const m of parsedMilestones) {
        assert(typeof m.id === 'number');
        assert(typeof m.text === 'string' && m.text.length > 0);
        assert(typeof m.done === 'boolean');
      }

      if (g.status === 'achieved') {
        achievedCount++;
      }
    }

    assert(achievedCount <= 1, `At most one goal may be achieved (found ${achievedCount})`);

    // Verify study goal matches seeded study hours
    const studyGoal = data.goals.find((g) => g.module === 'study');
    assert(studyGoal);
    const totalStudyHours = Math.round((data.studySessions.reduce((acc, s) => acc + s.durationMinutes, 0) / 60) * 10) / 10;
    assert.equal(studyGoal.currentValue, Math.min(studyGoal.targetValue, totalStudyHours));

    // Verify finance goal matches seeded savings + investments
    const finGoal = data.goals.find((g) => g.module === 'finance');
    assert(finGoal);
    const totalSavingsAndInvestments = data.financeTransactions
      .filter((t) => t.type === 'investment' || t.type === 'savings')
      .reduce((acc, t) => acc + t.amount, 0);
    assert.equal(finGoal.currentValue, Math.min(finGoal.targetValue, Math.round(totalSavingsAndInvestments * 100) / 100));
  });
});
