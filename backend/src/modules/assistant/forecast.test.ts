import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSingleForecast,
  computeFinancesForecast,
  FinanceTx,
} from './forecast.ts';

describe('Forecasting Logic (forecast.ts)', () => {
  const clientDate = '2026-10-10';

  // Helper to generate transaction series across N distinct days
  function generateTxSeries(
    distinctDaysCount: number,
    amountPerDay: number,
    type: 'expense' | 'income' = 'expense',
    startDate: string = '2026-08-01'
  ): FinanceTx[] {
    const [y, m, d] = startDate.split('-').map(Number);
    const txs: FinanceTx[] = [];
    for (let i = 0; i < distinctDaysCount; i++) {
      const dt = new Date(y, m - 1, d + i);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      txs.push({
        date: `${yyyy}-${mm}-${dd}`,
        type,
        amount: amountPerDay,
      });
    }
    return txs;
  }

  it('tier boundary: 13 active days yields insufficient_data with no totals', () => {
    const txs = generateTxSeries(13, 1000, 'expense');
    const result = computeSingleForecast(txs, 'expenses', 30, clientDate);

    assert.equal(result.status, 'insufficient_data');
    assert.equal(result.reliability, 'insufficient_data');
    assert.equal(result.activeDays, 13);
    assert.equal(result.requiredDays, 14);
    assert.equal(result.predictedTotal, undefined);
    assert.equal(result.dailyAverage, undefined);
  });

  it('tier boundary: 14 active days yields low_confidence', () => {
    const txs = generateTxSeries(14, 1000, 'expense');
    const result = computeSingleForecast(txs, 'expenses', 30, clientDate);

    assert.equal(result.status, 'ok');
    assert.equal(result.reliability, 'low_confidence');
    assert.equal(result.activeDays, 14);
    assert.ok(result.predictedTotal !== undefined && result.predictedTotal > 0);
  });

  it('tier boundary: 27 active days yields low_confidence', () => {
    const txs = generateTxSeries(27, 1000, 'expense');
    const result = computeSingleForecast(txs, 'expenses', 30, clientDate);

    assert.equal(result.status, 'ok');
    assert.equal(result.reliability, 'low_confidence');
    assert.equal(result.activeDays, 27);
  });

  it('tier boundary: 28 active days yields reliable', () => {
    const txs = generateTxSeries(28, 1000, 'expense');
    const result = computeSingleForecast(txs, 'expenses', 30, clientDate);

    assert.equal(result.status, 'ok');
    assert.equal(result.reliability, 'reliable');
    assert.equal(result.activeDays, 28);
  });

  it('zero-fills missing days so sparse series does not overstate forecast', () => {
    // 14 days active with 5000 each, but spaced across 60 days total
    const txs: FinanceTx[] = [];
    for (let i = 0; i < 14; i++) {
      // 1 transaction every 4 days
      const dt = new Date(2026, 7, 1 + i * 4);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      txs.push({
        date: `${dt.getFullYear()}-${mm}-${dd}`,
        type: 'expense',
        amount: 4000,
      });
    }

    const result = computeSingleForecast(txs, 'expenses', 30, clientDate);
    assert.equal(result.status, 'ok');

    // Total spending was 14 * 4000 = 56000 over ~56 days (~1000/day)
    // A non-zero-filled model would estimate 4000/day. With zero-filling, daily average should be near ~1000.
    assert.ok(result.dailyAverage! < 2000, `Expected daily average < 2000, got ${result.dailyAverage}`);
  });

  it('forecast predictions are never negative even with steep downward slope', () => {
    // Constant high values then steep decline
    const txs: FinanceTx[] = [];
    for (let i = 0; i < 30; i++) {
      const dt = new Date(2026, 8, 1 + i);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const amount = Math.max(10, 10000 - i * 400);
      txs.push({
        date: `${dt.getFullYear()}-${mm}-${dd}`,
        type: 'expense',
        amount,
      });
    }

    const result = computeSingleForecast(txs, 'expenses', 60, clientDate);
    assert.equal(result.status, 'ok');

    for (const pt of result.dailyPoints || []) {
      assert.ok(pt.predicted >= 0, 'Predicted value must be >= 0');
      assert.ok(pt.lower >= 0, 'Lower bound must be >= 0');
      assert.ok(pt.upper >= pt.lower, 'Upper bound must be >= lower bound');
    }
  });

  it('known-answer case: constant daily spending yields constant forecast', () => {
    // 30 consecutive days of exactly 2,000 INR
    const txs = generateTxSeries(30, 2000, 'expense', '2026-09-11');
    const result = computeSingleForecast(txs, 'expenses', 30, clientDate);

    assert.equal(result.status, 'ok');
    assert.equal(result.reliability, 'reliable');
    assert.equal(result.dailyAverage, 2000);
    assert.equal(result.predictedTotal, 60000); // 30 * 2000
    assert.equal(result.trailingActualTotal, 60000);
  });

  it('finances forecast computes net in code and inherits the weaker reliability tier', () => {
    // 30 days expenses (reliable) + 15 days income (low_confidence)
    const expTxs = generateTxSeries(30, 1000, 'expense', '2026-09-01');
    const incTxs = generateTxSeries(15, 3000, 'income', '2026-09-01');
    const combined = [...expTxs, ...incTxs];

    const result = computeFinancesForecast(combined, 30, clientDate);
    assert.equal(result.status, 'ok');
    // Weaker tier of (reliable, low_confidence) is low_confidence
    assert.equal(result.reliability, 'low_confidence');
    assert.ok(result.netPredicted !== undefined);
    assert.equal(
      result.netPredicted,
      (result.incomeResult?.predictedTotal || 0) - (result.expenseResult?.predictedTotal || 0)
    );
  });

  it('finances forecast returns available series with a note if only one series has sufficient data', () => {
    // 30 days expenses (reliable) + 5 days income (insufficient)
    const expTxs = generateTxSeries(30, 1000, 'expense', '2026-09-01');
    const incTxs = generateTxSeries(5, 3000, 'income', '2026-09-01');
    const combined = [...expTxs, ...incTxs];

    const result = computeFinancesForecast(combined, 30, clientDate);
    assert.equal(result.status, 'ok');
    assert.ok(result.expenseResult !== undefined);
    assert.match(result.note || '', /income has insufficient history/i);
  });
});
