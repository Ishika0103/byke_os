import { Router } from 'express';
import { authenticate } from './middlewares/authenticate';
import { buildAuthRouter } from './modules/auth/auth.routes';
import { hotelRouter } from './modules/hotels/hotel.routes';
import { roomTypeRouter } from './modules/room-types/room-type.routes';
import { roomRouter } from './modules/rooms/room.routes';
import { taskRouter } from './modules/tasks/task.routes';
import { uploadRouter } from './modules/uploads/upload.routes';
import { healthRouter } from './modules/health/health.routes';
import { roleRouter } from './modules/roles/role.routes';
import { userRouter } from './modules/users/user.routes';

/**
 * Versioned API root (/api/v1). Everything except /health and /auth/login|refresh
 * requires a valid access token. Part B will add permission checks per route.
 */
export function buildApiRouter() {
  const api = Router();

  api.use('/health', healthRouter);
  api.use('/auth', buildAuthRouter());

  api.use('/roles', authenticate, roleRouter);
  api.use('/users', authenticate, userRouter);
  // Hotel-owned data is nested under the hotel (CLAUDE.md).
  api.use('/hotels/:hotelId/room-types', authenticate, roomTypeRouter);
  api.use('/hotels/:hotelId/rooms', authenticate, roomRouter);
  api.use('/hotels/:hotelId/tasks', authenticate, taskRouter);
  api.use('/hotels/:hotelId/uploads', authenticate, uploadRouter);
  api.use('/hotels', authenticate, hotelRouter);

  return api;
}
