/**
 * Date calculation helpers for the assistant
 */

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function addDays(date: Date, days: number): Date {
  const res = new Date(date.getTime());
  res.setDate(res.getDate() + days);
  return res;
}

/**
 * Validates clientDate; if invalid or > 1 day from server date, returns server date.
 */
export function validateClientDate(clientDateStr: unknown, serverDate: Date = new Date()): string {
  const serverFormatted = formatDate(serverDate);
  if (typeof clientDateStr !== 'string') {
    return serverFormatted;
  }
  const parsed = parseDate(clientDateStr);
  if (!parsed) {
    return serverFormatted;
  }

  // Calculate day difference (ignoring time)
  const serverUtc = Date.UTC(serverDate.getFullYear(), serverDate.getMonth(), serverDate.getDate());
  const clientUtc = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.abs(Math.round((clientUtc - serverUtc) / (1000 * 60 * 60 * 24)));

  if (diffDays > 1) {
    return serverFormatted;
  }
  return clientDateStr;
}

export type ReportPeriod = 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'custom';

export function resolvePeriodDates(
  period: ReportPeriod,
  clientDateStr: string,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string; error?: string } {
  const clientDate = parseDate(clientDateStr);
  if (!clientDate) {
    return { startDate: clientDateStr, endDate: clientDateStr, error: 'Invalid client date' };
  }

  if (period === 'last_7_days') {
    const start = addDays(clientDate, -6);
    return { startDate: formatDate(start), endDate: clientDateStr };
  }

  if (period === 'last_30_days') {
    const start = addDays(clientDate, -29);
    return { startDate: formatDate(start), endDate: clientDateStr };
  }

  if (period === 'this_month') {
    const start = new Date(clientDate.getFullYear(), clientDate.getMonth(), 1);
    return { startDate: formatDate(start), endDate: clientDateStr };
  }

  if (period === 'last_month') {
    const start = new Date(clientDate.getFullYear(), clientDate.getMonth() - 1, 1);
    const end = new Date(clientDate.getFullYear(), clientDate.getMonth(), 0);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }

  if (period === 'custom') {
    if (!customStart || !customEnd) {
      return { startDate: clientDateStr, endDate: clientDateStr, error: 'Custom period requires startDate and endDate' };
    }
    const start = parseDate(customStart);
    const end = parseDate(customEnd);
    if (!start || !end) {
      return { startDate: clientDateStr, endDate: clientDateStr, error: 'Invalid custom dates format' };
    }
    if (start > end) {
      return { startDate: customStart, endDate: customEnd, error: 'Start date must be before or equal to end date' };
    }
    if (end > clientDate) {
      return { startDate: customStart, endDate: customEnd, error: 'End date cannot be in the future' };
    }
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 62) {
      return { startDate: customStart, endDate: customEnd, error: 'Date range span cannot exceed 62 days' };
    }
    return { startDate: customStart, endDate: customEnd };
  }

  return { startDate: clientDateStr, endDate: clientDateStr };
}

export interface WeekBucket {
  label: string;
  startDate: string;
  endDate: string;
}

export function createWeekBuckets(startDateStr: string, endDateStr: string): WeekBucket[] {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);
  if (!start || !end || start > end) return [];

  const buckets: WeekBucket[] = [];
  let currentStart = new Date(start);

  while (currentStart <= end) {
    const currentEnd = addDays(currentStart, 6);
    const actualEnd = currentEnd > end ? new Date(end) : currentEnd;
    const label = `${formatDate(currentStart).slice(5)} to ${formatDate(actualEnd).slice(5)}`;
    buckets.push({
      label,
      startDate: formatDate(currentStart),
      endDate: formatDate(actualEnd),
    });
    currentStart = addDays(actualEnd, 1);
  }

  return buckets;
}
