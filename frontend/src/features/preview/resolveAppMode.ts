export type AppMode = 'booting' | 'locked-preview' | 'app';

export interface AuthStateForAppMode {
  loading: boolean;
  user: unknown | null;
  isRegistered: boolean;
}

/**
 * Resolves the top-level application presentation mode based on authentication state.
 *
 * Rules:
 * 1. While loading is true, ALWAYS return 'booting' (never flash the locked preview or app).
 * 2. When loading is false:
 *    - If user is present and isRegistered is true -> return 'app'.
 *    - Otherwise (no user, or user rejected as not registered) -> return 'locked-preview'.
 */
export function resolveAppMode(authState: AuthStateForAppMode): AppMode {
  if (authState.loading) {
    return 'booting';
  }
  if (authState.user && authState.isRegistered) {
    return 'app';
  }
  return 'locked-preview';
}
