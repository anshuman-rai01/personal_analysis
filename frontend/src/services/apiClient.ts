/**
 * Typed API client and error wrapper for OmniLife Studio.
 */

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
 * Wraps fetch, parsing responses and throwing a typed ApiError when !res.ok.
 */
export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);

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
    if (res.status >= 500) {
      notify500Error(apiError);
    }
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
