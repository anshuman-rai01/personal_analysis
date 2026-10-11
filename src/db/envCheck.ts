/**
 * Regex identifying common placeholder tokens in environment variables.
 * Flags values beginning with YOUR_ or YOUR<space>, containing PASSWORD_HERE,
 * matching CHANGE_ME / CHANGEME, or beginning with MY_.
 */
export const DB_PLACEHOLDER_REGEX = /^YOUR[_ ]|PASSWORD_HERE|CHANGE_?ME|^MY_/i;

/**
 * Core database environment variables required for basic application database connectivity.
 */
export const REQUIRED_DB_ENV_VARS = [
  'SQL_HOST',
  'SQL_USER',
  'SQL_PASSWORD',
  'SQL_DB_NAME',
] as const;

/**
 * All database-related environment variables that may be configured and checked for placeholders.
 */
export const ALL_DB_ENV_VARS = [
  'SQL_HOST',
  'SQL_PORT',
  'SQL_USER',
  'SQL_PASSWORD',
  'SQL_DB_NAME',
  'SQL_ADMIN_USER',
  'SQL_ADMIN_PASSWORD',
] as const;

export interface ValidateDbEnvOptions {
  requireAdmin?: boolean;
}

/**
 * Pure function that validates database environment variables.
 * Returns an array of human-readable problem descriptions.
 * CRITICAL SECURITY RULE: The returned strings contain ONLY variable names and NEVER any values or secrets.
 *
 * @param env - Environment record (defaults to process.env)
 * @param options - Optional validation options
 * @returns Array of problem strings describing missing or placeholder variables.
 */
export function validateDbEnv(
  env: Record<string, string | undefined> = process.env,
  options?: ValidateDbEnvOptions
): string[] {
  const problems: string[] = [];

  const required: string[] = [...REQUIRED_DB_ENV_VARS];
  if (options?.requireAdmin) {
    required.push('SQL_ADMIN_USER', 'SQL_ADMIN_PASSWORD');
  }

  for (const key of required) {
    const val = env[key];
    if (val === undefined || val === null || val.trim() === '') {
      problems.push(`Missing required environment variable: ${key}`);
    }
  }

  for (const key of ALL_DB_ENV_VARS) {
    const val = env[key];
    if (val !== undefined && val !== null && val.trim() !== '') {
      if (DB_PLACEHOLDER_REGEX.test(val.trim())) {
        problems.push(`Environment variable ${key} contains a placeholder value`);
      } else if (key === 'SQL_PORT') {
        const portNum = Number(val);
        if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
          problems.push(`Environment variable ${key} must be a valid port number (1-65535)`);
        }
      }
    }
  }

  return problems;
}
