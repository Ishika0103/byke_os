import path from 'node:path';
import type mongoose from 'mongoose';
import { MongoDBStorage, Umzug, type MigrationFn } from 'umzug';
import { logger } from '../config/logger';

export type MigrationContext = { db: mongoose.mongo.Db };
export type Migration = MigrationFn<MigrationContext>;

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const TEMPLATE = `import type { Migration } from '../migrator';

/**
 * Rules (CLAUDE.md → Data conventions):
 * - Use the raw driver (context.db.collection(...)), never Mongoose models.
 * - Make it idempotent where possible, and give it a working down().
 * - Never edit this file after it has run on a shared database; write a new migration.
 */
export const up: Migration = async ({ context: { db } }) => {
  // e.g. await db.collection('things').createIndex({ field: 1 }, { name: 'field_1' });
};

export const down: Migration = async ({ context: { db } }) => {
  // e.g. await db.collection('things').dropIndex('field_1');
};
`;

/**
 * Versioned database migrations (Plan 01 §0.1).
 * Applied migrations are recorded in the `migrations` collection, so each runs once per database.
 */
export function createMigrator(db: mongoose.mongo.Db) {
  return new Umzug<MigrationContext>({
    migrations: {
      glob: ['*.{ts,js}', { cwd: MIGRATIONS_DIR, ignore: ['*.d.ts', '*.map'] }],
      // Record names WITHOUT the extension: migrations run as .ts in development and as
      // compiled .js in production, and must be recognised as the same migration.
      resolve: (params) =>
        Umzug.defaultResolver({ ...params, name: params.name.replace(/\.(ts|js)$/, '') }),
    },
    context: { db },
    storage: new MongoDBStorage({ collection: db.collection('migrations') }),
    logger: {
      info: (msg) => logger.info(msg),
      warn: (msg) => logger.warn(msg),
      error: (msg) => logger.error(msg),
      debug: (msg) => logger.debug(msg),
    },
    create: {
      folder: MIGRATIONS_DIR,
      template: (filepath) => [[filepath, TEMPLATE]],
    },
  });
}
