import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.MONGODB_URI): Promise<void> {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    // Indexes and collections are owned by migrations (src/db/migrations),
    // never auto-built from Mongoose schemas.
    autoIndex: false,
    autoCreate: false,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** Raw MongoDB driver handle (used by migrations). Requires an open connection. */
export function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}
