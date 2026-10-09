/**
 * Pure statistical forecasting functions for personal finances
 */

import { parseDate, addDays, formatDate } from './dates.ts';
import { ChartBlock, MetricsBlock, NoticeBlock, Block } from './types.ts';

export type ForecastSeriesType = 'expenses' | 'income' | 'savings' | 'finances';
export type ReliabilityTier = 'insufficient_data' | 'low_confidence' | 'reliable';

export interface FinanceTx {
  date: string;
  type: string;
  amount: number;
}

export interface SingleSeriesForecastResult {
  status: 'ok' | 'insufficient_data';
  series: 'expenses' | 'income' | 'savings';
  reliability: ReliabilityTier;
  activeDays: number;
  requiredDays: number;
  horizonDays: number;
  predictedTotal?: number;
  dailyAverage?: number;
  trailingActualTotal?: number;
  dailyPoints?: {
    date: string;
    predicted: number;
    lower: number;
    upper: number;
  }[];
}

export interface FinancesForecastResult {
  status: 'ok' | 'insufficient_data';
  series: 'finances';
  reliability?: ReliabilityTier;
  incomeResult?: SingleSeriesForecastResult;
  expenseResult?: SingleSeriesForecastResult;
  netPredicted?: number;
  note?: string;
}

export function computeSingleForecast(
  transactions: FinanceTx[],
  seriesType: 'expenses' | 'income' | 'savings',
  horizonDays: number,
  clientDateStr: string
): SingleSeriesForecastResult {
  const clientDate = parseDate(clientDateStr) || new Date();

  // Filter transactions for this series
  const relevant = transactions.filter(t => {
    if (seriesType === 'expenses') return t.type === 'expense';
    if (seriesType === 'income') return t.type === 'income';
    if (seriesType === 'savings') return t.type === 'savings' || t.type === 'investment';
    return false;
  }).filter(t => t.amount > 0 && t.date <= clientDateStr);

  // Distinct active days
  const distinctDays = new Set(relevant.map(t => t.date));
  const activeDays = distinctDays.size;

  if (activeDays < 14) {
    return {
      status: 'insufficient_data',
      series: seriesType,
      reliability: 'insufficient_data',
      activeDays,
      requiredDays: 14,
      horizonDays,
    };
  }

  const reliability: ReliabilityTier = activeDays >= 28 ? 'reliable' : 'low_confidence';

  // Find first transaction date
  let minDateStr = clientDateStr;
  for (const t of relevant) {
    if (t.date < minDateStr) {
      minDateStr = t.date;
    }
  }

  const minDate = parseDate(minDateStr) || clientDate;

  // Build daily series zero-filled from first transaction date to clientDate
  const dailySums = new Map<string, number>();
  for (const t of relevant) {
    dailySums.set(t.date, (dailySums.get(t.date) || 0) + t.amount);
  }

  const dailySeries: number[] = [];
  let curr = new Date(minDate);
  while (curr <= clientDate) {
    const dStr = formatDate(curr);
    dailySeries.push(dailySums.get(dStr) || 0);
    curr = addDays(curr, 1);
  }

  const N = dailySeries.length;
  // Trailing window of min(60, available) days
  const W = Math.min(60, N);
  const trailingSlice = dailySeries.slice(N - W);
  const trailingSum = trailingSlice.reduce((a, b) => a + b, 0);
  const trailingMean = W > 0 ? trailingSum / W : 0;

  // Damped linear trend calculation
  let slope = 0;
  if (W >= 2) {
    const xBar = (W - 1) / 2;
    let numerator = 0;
    let denominator = 0;
    for (let j = 0; j < W; j++) {
      const diffX = j - xBar;
      numerator += diffX * (trailingSlice[j] - trailingMean);
      denominator += diffX * diffX;
    }
    if (denominator > 0) {
      slope = numerator / denominator;
    }
  }

  // Trailing standard deviation of the last 30 daily values (for band)
  const S = Math.min(30, N);
  const slice30 = dailySeries.slice(N - S);
  const mean30 = S > 0 ? slice30.reduce((a, b) => a + b, 0) / S : 0;
  const variance30 = S > 0 ? slice30.reduce((acc, v) => acc + Math.pow(v - mean30, 2), 0) / S : 0;
  const stdDev30 = Math.sqrt(variance30);

  // Generate daily points over horizon (1 to horizonDays)
  const dampingFactor = 0.85;
  const dailyPoints: { date: string; predicted: number; lower: number; upper: number }[] = [];
  let predictedTotal = 0;

  for (let k = 1; k <= horizonDays; k++) {
    const pointDate = formatDate(addDays(clientDate, k));
    // Damped trend contribution
    const trendContribution = slope * Math.pow(dampingFactor, k) * k;
    const rawPredicted = Math.max(0, trailingMean + trendContribution);
    const predicted = Math.round(rawPredicted);
    predictedTotal += predicted;

    const lower = Math.max(0, Math.round(predicted - stdDev30));
    const upper = Math.round(predicted + stdDev30);

    dailyPoints.push({
      date: pointDate,
      predicted,
      lower,
      upper,
    });
  }

  const dailyAverage = Math.round(predictedTotal / horizonDays);

  // Actual trailing total for the same number of days
  const trailingActualSlice = dailySeries.slice(Math.max(0, N - horizonDays));
  const trailingActualTotal = trailingActualSlice.reduce((a, b) => a + b, 0);

  return {
    status: 'ok',
    series: seriesType,
    reliability,
    activeDays,
    requiredDays: 14,
    horizonDays,
    predictedTotal,
    dailyAverage,
    trailingActualTotal,
    dailyPoints,
  };
}

export function computeFinancesForecast(
  transactions: FinanceTx[],
  horizonDays: number,
  clientDateStr: string
): FinancesForecastResult {
  const expenseResult = computeSingleForecast(transactions, 'expenses', horizonDays, clientDateStr);
  const incomeResult = computeSingleForecast(transactions, 'income', horizonDays, clientDateStr);

  const expenseOk = expenseResult.status === 'ok';
  const incomeOk = incomeResult.status === 'ok';

  if (!expenseOk && !incomeOk) {
    return {
      status: 'insufficient_data',
      series: 'finances',
      expenseResult,
      incomeResult,
      note: `Insufficient transaction history for both expenses (${expenseResult.activeDays}/14 active days) and income (${incomeResult.activeDays}/14 active days).`,
    };
  }

  if (expenseOk && incomeOk) {
    const netPredicted = (incomeResult.predictedTotal || 0) - (expenseResult.predictedTotal || 0);
    // Overall reliability is the weaker tier
    const reliability: ReliabilityTier =
      expenseResult.reliability === 'low_confidence' || incomeResult.reliability === 'low_confidence'
        ? 'low_confidence'
        : 'reliable';

    return {
      status: 'ok',
      series: 'finances',
      reliability,
      incomeResult,
      expenseResult,
      netPredicted,
    };
  }

  // Only one is available
  if (expenseOk) {
    return {
      status: 'ok',
      series: 'finances',
      reliability: expenseResult.reliability,
      expenseResult,
      note: `Forecast available for expenses only (${expenseResult.activeDays} active days). Income has insufficient history (${incomeResult.activeDays}/14 active days).`,
    };
  }

  return {
    status: 'ok',
    series: 'finances',
    reliability: incomeResult.reliability,
    incomeResult,
    note: `Forecast available for income only (${incomeResult.activeDays} active days). Expenses has insufficient history (${expenseResult.activeDays}/14 active days).`,
  };
}
