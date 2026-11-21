import type { Response } from 'express';
import type { ApiSuccess } from '@byke-os/shared';

/** Sends the standard success envelope: { success: true, data }. */
export function ok<T>(res: Response, data: T, status = 200) {
  const body: ApiSuccess<T> = { success: true, data };
  return res.status(status).json(body);
}
