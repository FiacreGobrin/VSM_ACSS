import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, setAuthTokenProvider, setUnauthorizedHandler } from '../lib/apiClient';

/**
 * Contract tests for the Express -> browser boundary.
 *
 * The console depends on the API's `{ success, data, meta }` envelope and on
 * the error `code` being surfaced, so both are asserted here rather than
 * relying on manual inspection of a live database.
 */
describe('API client envelope handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthTokenProvider(() => 'test-token');
    setUnauthorizedHandler(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** Builds a minimal Response stand-in for the mocked fetch. */
  const mockResponse = (body: unknown, status = 200) => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    }) as unknown as typeof fetch;
  };

  it('unwraps `data` from a successful envelope', async () => {
    mockResponse({ success: true, data: { id: 'v-1', full_name: 'Sarah Connor' } });

    const visitor = await api.get<{ id: string; full_name: string }>('/api/v1/visitors/v-1');

    expect(visitor.id).toBe('v-1');
    expect(visitor.full_name).toBe('Sarah Connor');
  });

  it('surfaces pagination metadata from `meta`', async () => {
    mockResponse({ success: true, data: [1, 2], meta: { total: 42, limit: 2, offset: 0 } });

    const page = await api.getPage<number[]>('/api/v1/visitors');

    expect(page.data).toEqual([1, 2]);
    expect(page.meta).toEqual({ total: 42, limit: 2, offset: 0 });
  });

  it('returns null meta when the endpoint sends no pagination', async () => {
    mockResponse({ success: true, data: [] });

    const page = await api.getPage<number[]>('/api/v1/visitors');

    expect(page.meta).toBeNull();
  });

  it('preserves the backend error code and message', async () => {
    mockResponse(
      { success: false, error: { code: 'forbidden', message: 'Role "auditor" lacks permissions' } },
      403
    );

    await expect(api.get('/api/v1/visitors')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'forbidden',
      message: 'Role "auditor" lacks permissions',
    });
  });

  it('flags 401 and 403 as authentication errors', async () => {
    mockResponse({ success: false, error: { code: 'unauthorized', message: 'Token expired' } }, 401);

    const error = await api.get('/api/v1/visitors').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isAuthError).toBe(true);
  });

  it('invokes the unauthorized handler when the API rejects the token', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockResponse({ success: false, error: { code: 'invalid_token', message: 'Bad token' } }, 401);

    await expect(api.get('/api/v1/visitors')).rejects.toBeInstanceOf(ApiError);

    // A 401 must tear down the session, otherwise the console loops on
    // failing requests instead of returning the operator to the login screen.
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports a network failure distinctly from an API rejection', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    const error = await api.get('/health').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('network_error');
    expect((error as ApiError).status).toBe(0);
  });

  it('attaches the bearer token to authenticated requests', async () => {
    mockResponse({ success: true, data: {} });

    await api.get('/api/v1/dashboard/summary');

    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
  });

  it('omits the bearer token on public endpoints such as login', async () => {
    mockResponse({ success: true, data: { token: 'jwt', user: {} } });

    await api.post('/api/v1/auth/login', { username: 'admin', password: 'x' }, { auth: false });

    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('drops empty query parameters instead of sending blanks', async () => {
    mockResponse({ success: true, data: [] });

    await api.get('/api/v1/visitors', {
      query: { q: 'sarah', status: '', limit: 20, offset: 0 },
    });

    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] as string;

    expect(url).toContain('q=sarah');
    expect(url).toContain('limit=20');
    expect(url).not.toContain('status=');
  });

  it('rejects a malformed body rather than silently returning undefined', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'not json',
    }) as unknown as typeof fetch;

    await expect(api.get('/api/v1/visitors')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});
