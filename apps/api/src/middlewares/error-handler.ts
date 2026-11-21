import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import type { ApiError } from '@byke-os/shared';
import { AppError } from '../utils/app-error';
import { isProd } from '../config/env';
import { logger } from '../config/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/** Maps a MongoDB duplicate-key error to a specific 409 code based on the index field. */
function duplicateKeyError(err: { keyPattern?: Record<string, unknown> }): AppError {
  // Hotel-owned indexes start with hotelId; the field that clashed is the next one.
  const field = Object.keys(err.keyPattern ?? {}).find((k) => k !== 'hotelId');
  if (field === 'email') return AppError.conflict('EMAIL_TAKEN', 'Email already registered');
  if (field === 'code') return AppError.conflict('CODE_TAKEN', 'Code already exists');
  if (field === 'name') return AppError.conflict('NAME_TAKEN', 'Name already exists');
  if (field === 'roomNumber') {
    return AppError.conflict('ROOM_NUMBER_TAKEN', 'Room number already exists');
  }
  return AppError.conflict('CONFLICT', 'Resource already exists');
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof mongoose.Error.CastError) {
    appError = AppError.field(err.path, `Invalid ${err.path}`);
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, [v.message]]),
    );
    appError = AppError.validation('Validation failed', details);
  } else if ((err as { code?: number }).code === 11000) {
    appError = duplicateKeyError(err);
  } else if ((err as { type?: string }).type === 'entity.parse.failed') {
    appError = AppError.validation('Malformed JSON body');
  } else {
    logger.error({ err }, 'Unhandled error');
    const message = isProd ? 'Something went wrong' : String(err?.message ?? err);
    appError = new AppError(500, 'INTERNAL_ERROR', message);
  }

  const body: ApiError = {
    success: false,
    error: { code: appError.code, message: appError.message, details: appError.details },
  };
  res.status(appError.statusCode).json(body);
};
