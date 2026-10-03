/**
 * Base URL for the Express gateway that fronts the Neon Postgres database.
 *
 * The browser must never hold the Postgres connection string — `DATABASE_URL`
 * lives only in `backend/.env`. In development Vite proxies these paths to the
 * local API (see `vite.config.ts`), so an empty value here is valid and keeps
 * requests same-origin.
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Envelope returned by the API's `sendSuccess` helper. */
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Pagination metadata attached to list endpoints. */
export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Normalised API failure. Carries the HTTP status and the backend's stable
 * error code so callers can branch on `code` rather than parsing messages.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the failure is an authentication/authorisation problem. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Query parameters; `undefined`/`null`/`''` entries are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Set false for public endpoints such as login. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
}

/**
 * A FormData body must be passed through to fetch untouched.
 *
 * Setting `Content-Type: application/json` by hand on a multipart request
 * strips the `boundary=` parameter, and the server then cannot parse the body
 * at all - the request fails with "Unexpected end of form". The browser is the
 * only party that knows the boundary, so it must be left to generate the header.
 */
function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

/**
 * Supplies the current bearer token. Registered by the auth store so this
 * module stays free of store imports (and of import cycles).
 */
type TokenProvider = () => string | null;
let tokenProvider: TokenProvider = () => null;

export function setAuthTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

/**
 * Invoked when the API rejects a token, so the console can drop the stale
 * session and route back to the login screen. Set by the auth store.
 */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler = () => {};

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalisedPath}`;

  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Performs the fetch and returns the parsed envelope.
 * Shared by the plain and paginated helpers so error handling stays identical.
 */
async function send<T>(
  path: string,
  options: RequestOptions
): Promise<ApiEnvelope<T> | null> {
  const { method = 'GET', body, query, auth = true, signal } = options;

  const isMultipart = isFormDataBody(body);
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Deliberately skipped for FormData: the browser appends the multipart
  // boundary itself, and overriding it corrupts the request.
  if (body !== undefined && !isMultipart) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? (isMultipart ? (body as FormData) : JSON.stringify(body)) : undefined,
      signal,
    });
  } catch (err) {
    // A transport-level failure means the API host itself is unreachable.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'network_error',
      'Unable to reach the VMS-ACS API. Verify the backend service is running.'
    );
  }

  const text = await response.text();
  let payload: ApiEnvelope<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(
        response.status,
        'invalid_response',
        'API returned a malformed response body.'
      );
    }
  }

  if (!response.ok || !payload?.success) {
    const code = payload?.error?.code ?? `http_${response.status}`;
    const message = payload?.error?.message ?? `Request failed with status ${response.status}`;

    // A rejected token means the session is no longer valid on the server.
    if (response.status === 401 && auth) unauthorizedHandler();

    throw new ApiError(response.status, code, message, payload?.error?.details);
  }

  return payload;
}

/**
 * Multipart upload with progress reporting, via XMLHttpRequest.
 *
 * `fetch` exposes upload progress only in browsers that have not shipped the
 * feature, so XHR remains the only way to drive a progress bar. The response is
 * funnelled through the same envelope parsing as `send` so error handling does
 * not diverge between the two transports.
 */
function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (percent: number) => void,
  options: Omit<RequestOptions, 'method' | 'body'>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path, options.query), true);
    xhr.responseType = 'text';

    xhr.upload.onprogress = (event) => {
      // `lengthComputable` is false when the total length is unknown (chunked
      // transfer encoding), in which case no meaningful percentage exists.
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () =>
      reject(
        new ApiError(0, 'network_error', 'Upload failed: the VMS-ACS API is unreachable.')
      );

    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));

    xhr.onload = () => {
      let payload: ApiEnvelope<T> | null = null;
      try {
        payload = xhr.responseText ? (JSON.parse(xhr.responseText) as ApiEnvelope<T>) : null;
      } catch {
        return reject(
          new ApiError(xhr.status, 'invalid_response', 'API returned a malformed response body.')
        );
      }

      if (xhr.status < 200 || xhr.status >= 300 || !payload?.success) {
        const code = payload?.error?.code ?? `http_${xhr.status}`;
        const message =
          payload?.error?.message ?? `Upload failed with status ${xhr.status}`;
        if (xhr.status === 401) unauthorizedHandler();
        return reject(new ApiError(xhr.status, code, message, payload?.error?.details));
      }

      onProgress(100);
      resolve(payload.data as T);
    };

    // A caller-supplied AbortSignal must cancel the XHR too, otherwise the
    // upload keeps streaming after the operator navigates away.
    const signal = options.signal;
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.auth !== false) {
      const token = tokenProvider();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);

    // Note: no Content-Type is set here. The browser adds it together with the
    // multipart boundary when the FormData is handed to `send`.
    xhr.send(form);
  });
}

/**
 * Downloads a protected binary resource as a Blob.
 *
 * `<video src>` and `<img src>` cannot carry an `Authorization` header, so the
 * console cannot point an element straight at the API's media endpoint. The
 * bytes are therefore fetched with the bearer token attached and handed to the
 * element as an object URL.
 *
 * Trade-off: this buffers the whole clip in memory before playback starts.
 * That is acceptable for the reference stills and short clips the console
 * previews. If large archives must be streamed inline, the fix belongs on the
 * server: mint a short-lived, single-use signed URL that the element can use
 * directly.
 */
export async function fetchAuthenticatedBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path), { headers, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Unable to reach the VMS-ACS API.');
  }

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler();
    throw new ApiError(
      response.status,
      `http_${response.status}`,
      `Failed to load media (status ${response.status}).`
    );
  }

  return response.blob();
}

/**
 * Typed façade over the VMS-ACS REST API.
 *
 * All console traffic to Neon Postgres funnels through here. Database
 * credentials never reach the browser — the Express layer owns the pool.
 */
export const api = {
  /** Issues a request and unwraps `data` from the success envelope. */
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...options, method: 'GET' }).then((p) => p?.data as T),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...options, method: 'POST', body }).then((p) => p?.data as T),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...options, method: 'PUT', body }).then((p) => p?.data as T),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...options, method: 'PATCH', body }).then((p) => p?.data as T),

  /** Issues a DELETE. Used for evidence removal and other destructive actions. */
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...options, method: 'DELETE' }).then((p) => p?.data as T),

  /**
   * Sends a multipart/form-data body (file uploads).
   *
   * `onProgress` is supported via XHR because `fetch` still cannot report
   * upload progress in any shipping browser. Callers that do not pass it get
   * the plain `fetch` path.
   */
  upload: <T>(
    path: string,
    form: FormData,
    options?: Omit<RequestOptions, 'method' | 'body'> & {
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<T> => {
    const { onProgress, ...rest } = options ?? {};

    if (!onProgress) {
      return send<T>(path, { ...rest, method: 'POST', body: form }).then((p) => p?.data as T);
    }

    return uploadWithProgress<T>(path, form, onProgress, rest);
  },

  /**
   * Issues a request against a list endpoint and returns the rows together
   * with the server's pagination metadata.
   */
  getPage: async <T>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<{ data: T; meta: PageMeta | null }> => {
    const payload = await send<T>(path, { ...options, method: 'GET' });
    const meta = payload?.meta as PageMeta | undefined;
    return {
      data: payload?.data as T,
      meta: meta && typeof meta.total === 'number' ? meta : null,
    };
  },
};

export { API_BASE_URL };
