import { execSync } from 'node:child_process';
import mongoose from 'mongoose';

/**
 * Runs once before all test files: wipes the test database, then applies every
 * migration through the real CLI (the same command used in deployment).
 * Vitest runs from apps/api, so paths are relative to it.
 */
export default async function setup() {
  const uri = process.env.MONGODB_URI;
  if (!uri?.includes('_test')) {
    throw new Error(`Refusing to wipe a non-test database: ${uri}`);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  execSync('npx tsx src/db/migrate.ts up', { env: process.env, stdio: 'pipe' });
}
