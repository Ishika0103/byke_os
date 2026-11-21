import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../../utils/respond';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  ok(res, {
    status: 'ok',
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});
