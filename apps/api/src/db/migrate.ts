/**
 * Migration CLI (umzug). Usage from apps/api:
 *   npm run migrate -- up | down | pending | executed | create --name <name>.ts
 * Shortcuts: migrate:up, migrate:down, migrate:status, migrate:create.
 */
import { logger } from '../config/logger';
import { createMigrator } from './migrator';
import { connectDatabase, disconnectDatabase, getDb } from './mongoose';

async function main() {
  await connectDatabase();
  try {
    await createMigrator(getDb()).runAsCLI();
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Migration failed');
  process.exit(1);
});
