import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  apiFetch,
  onServer500Error,
  notify500Error,
  getLocalDateString,
} from './apiClient.ts';

describe('apiClient and getLocalDateString', () => {
  it('formats local date correctly matching YYYY-MM-DD', () => {
    const testDate = new Date(2026, 9, 11, 0, 15); // Oct 11, 2026, 00:15
    const dateStr = getLocalDateString(testDate);
    assert.equal(dateStr, '2026-10-11');
  });

  it('notifies 500 error listeners on server failure', () => {
    let notified = false;
    let receivedStatus = 0;

    const unsubscribe = onServer500Error((err) => {
      notified = true;
      receivedStatus = err.status;
    });

    const testError = new ApiError(500, 'Internal Server Error');
    notify500Error(testError);

    assert.equal(notified, true);
    assert.equal(receivedStatus, 500);

    // Unsubscribe and verify no further triggers
    notified = false;
    unsubscribe();
    notify500Error(testError);
    assert.equal(notified, false);
  });

  it('throws typed ApiError with status and server error message when !res.ok', async () => {
    // Stub global.fetch
    const originalFetch = global.fetch;
    try {
      (global as any).fetch = async () => {
        return {
          ok: false,
          status: 500,
          headers: {
            get: (h: string) => (h === 'content-type' ? 'application/json' : null),
          },
          json: async () => ({ error: 'database relation does not exist' }),
          text: async () => 'database relation does not exist',
        };
      };

      await assert.rejects(
        async () => {
          await apiFetch('/api/test-failure');
        },
        (err: any) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.status, 500);
          assert.equal(err.message, 'database relation does not exist');
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('resolves parsed json payload on successful 200 response', async () => {
    const originalFetch = global.fetch;
    try {
      (global as any).fetch = async () => {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (h: string) => (h === 'content-type' ? 'application/json' : null),
          },
          json: async () => [{ id: 1, name: 'Success Record' }],
        };
      };

      const result = await apiFetch<Array<{ id: number; name: string }>>('/api/test-success');
      assert.deepEqual(result, [{ id: 1, name: 'Success Record' }]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
