/**
 * In-memory sliding-window rate limiter per user
 */

interface RateLimitState {
  timestamps: number[];
}

const windowMap = new Map<string, RateLimitState>();

export function getRateLimitPerMinute(): number {
  const envVal = process.env.ASSISTANT_RATE_LIMIT_PER_MIN;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 20;
}

export function checkRateLimit(
  uid: string,
  limit: number = getRateLimitPerMinute(),
  now: number = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const windowDurationMs = 60 * 1000;
  const cutoff = now - windowDurationMs;

  let state = windowMap.get(uid);
  if (!state) {
    state = { timestamps: [] };
    windowMap.set(uid, state);
  }

  // Filter out timestamps older than 60 seconds
  state.timestamps = state.timestamps.filter(ts => ts > cutoff);

  if (state.timestamps.length >= limit) {
    // Oldest timestamp in window determines retry-after
    const oldest = state.timestamps[0];
    const retryAfterMs = Math.max(1000, oldest + windowDurationMs - now);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  state.timestamps.push(now);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearRateLimitState(): void {
  windowMap.clear();
}
