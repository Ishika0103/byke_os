import type { ApiResponse } from '@byke-os/shared';
import { env } from '@/config/env';
import { session } from '@/lib/auth/session';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** First error message for a form field, if the API returned one. */
  fieldError(field: string): string | undefined {
    return this.details?.[field]?.[0];
  }
}

type RequestOptions = RequestInit & {
  /** Public endpoints (login) don't send the token or trigger a refresh. */
  skipAuth?: boolean;
};

async function send(path: string, init: RequestOptions): Promise<Response> {
  const token = init.skipAuth ? null : session.getAccessToken();
  // For FormData (file uploads) fetch sets the multipart Content-Type itself.
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  return fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      ...(!isForm && { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  });
}

/**
 * The only place in the app that calls fetch. Unwraps the API envelope and, on a 401,
 * refreshes the access token once and retries (Plan 01a flow 3).
 */
async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  let res = await send(path, init);

  if (res.status === 401 && !init.skipAuth) {
    const newToken = await session.refresh();
    if (newToken) res = await send(path, init);
  }

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    const { code, message, details } = body.error;
    throw new ApiClientError(res.status, code, message, details as Record<string, string[]>);
  }
  return body.data;
}

/** A file the API sent back (e.g. an Excel sheet), with its name. Errors still come as JSON. */
async function requestFile(
  path: string,
  init: RequestOptions = {},
): Promise<{ data: ArrayBuffer; fileName: string }> {
  let res = await send(path, init);
  if (res.status === 401 && !init.skipAuth) {
    const newToken = await session.refresh();
    if (newToken) res = await send(path, init);
  }
  if (!res.ok) {
    const body = (await res.json()) as ApiResponse<never>;
    if (!body.success) {
      const { code, message, details } = body.error;
      throw new ApiClientError(res.status, code, message, details as Record<string, string[]>);
    }
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
  return { data: await res.arrayBuffer(), fileName: match?.[1] ?? 'download.xlsx' };
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, opts),
  post: <T>(path: string, data?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T = void>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
  /** GET a file (Excel download). */
  file: (path: string, opts?: RequestOptions) => requestFile(path, opts),
  /** POST a form and get a file back (Excel of rejected rows). */
  uploadForFile: (path: string, form: FormData, opts?: RequestOptions) =>
    requestFile(path, { ...opts, method: 'POST', body: form }),
  /** multipart/form-data POST, e.g. a photo upload. */
  upload: <T>(path: string, form: FormData, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body: form }),
};

/** Full URL for a file path the API returned, e.g. "/uploads/<name>.jpg". */
export function apiFileUrl(path: string): string {
  return new URL(path, env.apiUrl).toString();
}
