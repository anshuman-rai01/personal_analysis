/**
 * Typed API client and error wrapper for OmniLife Studio.
 */
import { auth } from './firebase.ts';
import { signOut } from 'firebase/auth';

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type Error500Listener = (err: ApiError) => void;
const error500Listeners: Set<Error500Listener> = new Set();

/**
 * Registers a listener triggered whenever an API call returns HTTP 500 or higher.
 * Used by the global health banner to dynamically re-check database health.
 */
export function onServer500Error(listener: Error500Listener): () => void {
  error500Listeners.add(listener);
  return () => {
    error500Listeners.delete(listener);
  };
}

export function notify500Error(err: ApiError): void {
  for (const listener of error500Listeners) {
    try {
      listener(err);
    } catch (_e) {
      // Ignore listener errors
    }
  }
}

type UnauthListener = () => void;
const unauthListeners: Set<UnauthListener> = new Set();

export function onUnauthenticated(listener: UnauthListener): () => void {
  unauthListeners.add(listener);
  return () => {
    unauthListeners.delete(listener);
  };
}

export function notifyUnauthenticated(): void {
  for (const listener of unauthListeners) {
    try {
      listener();
    } catch (_e) {
      // Ignore listener errors
    }
  }
}

/**
 * Returns YYYY-MM-DD for the local timezone (preventing UTC offset issues).
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * authedFetch: Injects Firebase Auth bearer token into requests.
 * On HTTP 401: calls auth.currentUser?.getIdToken(true) and retries once.
 * If retry still fails with 401, or if HTTP 403 NOT_REGISTERED is received, signs the user out.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let token: string | null = null;
  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (_err) {
      token = null;
    }
  }

  const headers = new Headers(init?.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(input, { ...init, headers });

  // On 401, refresh token once and retry
  if (res.status === 401 && auth.currentUser) {
    try {
      const refreshedToken = await auth.currentUser.getIdToken(true);
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      res = await fetch(input, { ...init, headers });
    } catch (_refreshErr) {
      // Refresh failed
    }

    if (res.status === 401) {
      await signOut(auth).catch(() => {});
      notifyUnauthenticated();
    }
  }

  // A 403 NOT_REGISTERED anywhere also signs the user out
  if (res.status === 403) {
    try {
      const cloned = res.clone();
      const body = await cloned.json();
      if (body?.code === 'NOT_REGISTERED') {
        await signOut(auth).catch(() => {});
        notifyUnauthenticated();
      }
    } catch (_err) {
      // Ignore parse error
    }
  }

  if (res.status >= 500) {
    notify500Error(new ApiError(res.status, `Server error HTTP ${res.status}`));
  }

  return res;
}

/**
 * Wraps fetch, parsing responses and throwing a typed ApiError when !res.ok.
 */
export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await authedFetch(input, init);

  if (!res.ok) {
    let errorMsg = `Request failed (HTTP ${res.status})`;
    let errorData: any = null;

    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        errorData = await res.json();
        if (errorData && typeof errorData.error === 'string') {
          errorMsg = errorData.error;
        } else if (errorData && typeof errorData.message === 'string') {
          errorMsg = errorData.message;
        }
      } else {
        const text = await res.text();
        if (text) {
          errorMsg = text;
        }
      }
    } catch (_parseErr) {
      // Use fallback error message
    }

    const apiError = new ApiError(res.status, errorMsg, errorData);
    throw apiError;
  }

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }

  return (await res.text()) as unknown as T;
}
