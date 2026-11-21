import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Tests run against a real MongoDB (Docker locally, a service container in CI),
 * in a separate `byke_os_test` database that is wiped before each run.
 */
const TEST_ENV = {
  NODE_ENV: 'test',
  MONGODB_URI: process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/byke_os_test',
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long',
  BCRYPT_COST: '10',
  UPLOAD_DIR: join(tmpdir(), 'byke-os-test-uploads'),
};

// Applied here too so globalSetup (which runs in this process) sees the same values.
Object.assign(process.env, TEST_ENV);

export default defineConfig({
  test: {
    environment: 'node',
    env: TEST_ENV,
    globalSetup: ['./tests/global-setup.ts'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
