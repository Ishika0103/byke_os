import { ApiClientError } from '@/lib/api-client';

export type FieldErrors = Record<string, string | undefined>;

type Issue = { path: readonly PropertyKey[]; message: string };

/** First message per field from a failed Zod `safeParse` (the shared schemas). */
export function issuesToFieldErrors(issues: readonly Issue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '_form');
    errors[field] ??= issue.message;
  }
  return errors;
}

const OFFLINE = 'Cannot reach the server. Check your connection and try again.';

/**
 * Splits an API error into per-field messages and a form-level message.
 * `codeFields` maps error codes to the field they belong to, e.g. { EMAIL_TAKEN: 'email' }.
 */
export function apiErrorToForm(
  error: unknown,
  codeFields: Record<string, string> = {},
): { fields: FieldErrors; message: string | null } {
  if (!(error instanceof ApiClientError)) return { fields: {}, message: OFFLINE };

  const fields: FieldErrors = {};
  for (const [field, messages] of Object.entries(error.details ?? {})) {
    if (messages?.[0]) fields[field] = messages[0];
  }
  const field = codeFields[error.code];
  if (field) fields[field] = error.message;

  const hasFieldError = Object.keys(fields).length > 0;
  return { fields, message: hasFieldError ? null : error.message };
}

/** A readable message for any error (lists, deletes, dialogs). */
export function errorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : OFFLINE;
}
