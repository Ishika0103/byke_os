/** Error codes the API can return (Plan 01a §4 "Error responses"). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'ACCOUNT_DISABLED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'CODE_TAKEN'
  | 'NAME_TAKEN'
  | 'ROLE_IN_USE'
  | 'ROOM_TYPE_IN_USE'
  | 'HOTEL_IN_USE'
  | 'ROOM_NUMBER_TAKEN'
  | 'INVALID_STAGE'
  | 'SELF_VERIFY'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

/** Operational error with an HTTP status; anything else is treated as a 500. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message = 'Validation failed', details?: unknown) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  /** Field-level validation error, shaped like Zod's flatten().fieldErrors. */
  static field(field: string, message: string) {
    return new AppError(400, 'VALIDATION_ERROR', message, { [field]: [message] });
  }

  static unauthenticated(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static accountDisabled() {
    return new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled');
  }

  static forbidden(message = 'You are not allowed to do this') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(
    code: Extract<ErrorCode, `${string}_TAKEN` | `${string}_IN_USE` | 'INVALID_STAGE' | 'CONFLICT'>,
    message: string,
  ) {
    return new AppError(409, code, message);
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new AppError(429, 'TOO_MANY_REQUESTS', message);
  }
}
