import type { RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';
import { objectIdSchema } from '@byke-os/shared';
import { AppError } from '../utils/app-error';

/** Validates req.body against a Zod schema and replaces it with the parsed value. */
export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(AppError.validation('Validation failed', flatten(result.error)));
    }
    req.body = result.data;
    next();
  };

/**
 * Validates req.query. Express 5 makes req.query read-only, so the parsed value
 * is stored on res.locals.query; read it with `getQuery(res)`.
 */
export const validateQuery =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(AppError.validation('Invalid query parameters', flatten(result.error)));
    }
    res.locals.query = result.data;
    next();
  };

export function getQuery<S extends ZodType>(res: Response): z.infer<S> {
  return res.locals.query as z.infer<S>;
}

/** router.param handler: rejects malformed ObjectIds with 400 before hitting the database. */
export const validateObjectIdParam = (
  req: Parameters<RequestHandler>[0],
  _res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
  value: string,
) => {
  if (!objectIdSchema.safeParse(value).success) {
    return next(AppError.field('id', 'Invalid id'));
  }
  next();
};

function flatten(error: z.ZodError) {
  const { fieldErrors, formErrors } = z.flattenError(error);
  return formErrors.length ? { ...fieldErrors, _errors: formErrors } : fieldErrors;
}
