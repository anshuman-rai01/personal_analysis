/**
 * Shared thresholds, evaluation helpers, and gate constants for ML Forecasting and Simulation.
 * Pure module with zero database or environmental dependencies.
 */

export const FORECAST_MIN_ACTIVE_DAYS = 14;
export const FORECAST_RELIABLE_ACTIVE_DAYS = 28;
export const FORECAST_MIN_CSV_ROWS = 14;

export type ForecastReadinessStatus = 'insufficient' | 'low_confidence' | 'reliable';
export type ForecastModuleType = 'study' | 'finance' | 'habits';

export interface ActiveDaysEvaluation {
  status: ForecastReadinessStatus;
  allowed: boolean;
  remaining: number;
}

/**
 * Evaluates active logged days against prediction readiness thresholds.
 * - < 14 days: insufficient (locked, training prohibited)
 * - 14-27 days: low_confidence (allowed with notice)
 * - 28+ days: reliable (fully unlocked)
 */
export function evaluateActiveDays(days: number): ActiveDaysEvaluation {
  const safeDays = Math.max(0, Math.floor(days || 0));
  if (safeDays < FORECAST_MIN_ACTIVE_DAYS) {
    return {
      status: 'insufficient',
      allowed: false,
      remaining: FORECAST_MIN_ACTIVE_DAYS - safeDays,
    };
  }
  if (safeDays < FORECAST_RELIABLE_ACTIVE_DAYS) {
    return {
      status: 'low_confidence',
      allowed: true,
      remaining: 0,
    };
  }
  return {
    status: 'reliable',
    allowed: true,
    remaining: 0,
  };
}

/**
 * Maps simulation scenario identifiers to their underlying activity module.
 * Returns null if scenario is unknown.
 */
export function scenarioToModule(scenarioType: string): ForecastModuleType | null {
  if (scenarioType === 'study_career') return 'study';
  if (scenarioType === 'wealth_accumulation') return 'finance';
  if (scenarioType === 'lifestyle_habits' || scenarioType === 'lifestyle_balance') return 'habits';
  return null;
}

/**
 * Counts non-blank data rows in a CSV string (excluding the header line).
 * Handles CRLF (\r\n), LF (\n), and CR (\r) endings cleanly.
 */
export function countCsvDataRows(csv: string): number {
  if (!csv || typeof csv !== 'string') return 0;
  const lines = csv
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // If there are 0 or only 1 non-empty line (the header), there are 0 data rows
  if (lines.length <= 1) return 0;
  return lines.length - 1;
}

export interface InsufficientDataResponse {
  error: string;
  code: 'INSUFFICIENT_DATA';
  module: string;
  source: 'tracked' | 'csv';
  have: number;
  required: number;
  remaining: number;
}

/**
 * Constructs a standardized HTTP 422 INSUFFICIENT_DATA response body.
 */
export function buildInsufficientBody(
  module: string,
  source: 'tracked' | 'csv',
  have: number,
  required: number = source === 'csv' ? FORECAST_MIN_CSV_ROWS : FORECAST_MIN_ACTIVE_DAYS
): InsufficientDataResponse {
  const safeHave = Math.max(0, have || 0);
  const remaining = Math.max(0, required - safeHave);

  let humanMessage = '';
  if (source === 'csv') {
    humanMessage = `Uploaded CSV has insufficient data rows (${safeHave} rows). At least ${required} rows are required for model training.`;
  } else {
    const daysWord = remaining === 1 ? 'day' : 'days';
    humanMessage = `Not enough data to generate predictions yet. You have logged ${safeHave} of the ${required} days of ${module} activity needed. Log ${remaining} more ${daysWord} to unlock it.`;
  }

  return {
    error: humanMessage,
    code: 'INSUFFICIENT_DATA',
    module,
    source,
    have: safeHave,
    required,
    remaining,
  };
}
