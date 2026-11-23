/**
 * Creates the first Super Admin from SEED_ADMIN_* in apps/api/.env (Plan 01a §5.7).
 * Safe to re-run: does nothing if a Super Admin already exists.
 * Run `npm run migrate:up` first (it creates the system roles).
 */
import { z } from 'zod';
import { SUPER_ADMIN_ROLE_CODE, createUserSchema } from '@byke-os/shared';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { DepartmentModel } from '../modules/departments/department.model';
import { RoleModel } from '../modules/roles/role.model';
import { UserModel } from '../modules/users/user.model';
import { userService } from '../modules/users/user.service';
import { connectDatabase, disconnectDatabase } from './mongoose';

async function seed() {
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_MOBILE, SEED_ADMIN_PASSWORD } = env;
  if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_MOBILE || !SEED_ADMIN_PASSWORD) {
    throw new Error(
      'Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD in apps/api/.env',
    );
  }

  const role = await RoleModel.findOne({ code: SUPER_ADMIN_ROLE_CODE }).select('_id').lean();
  if (!role) throw new Error('SUPER_ADMIN role not found. Run `npm run migrate:up` first.');

  if (await UserModel.exists({ roleId: role._id })) {
    logger.info('A Super Admin already exists, nothing to do');
    return;
  }

  const department = await DepartmentModel.findOne({ code: 'HK' }).select('_id').lean();
  if (!department) throw new Error('Department HK not found. Run `npm run migrate:up` first.');

  const parsed = createUserSchema.safeParse({
    name: SEED_ADMIN_NAME,
    email: SEED_ADMIN_EMAIL,
    mobile: SEED_ADMIN_MOBILE,
    roleId: String(role._id),
    departmentIds: [String(department._id)],
    password: SEED_ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid SEED_ADMIN_* values: ${JSON.stringify(z.flattenError(parsed.error).fieldErrors)}`,
    );
  }

  const user = await userService.create(parsed.data, null, true);
  logger.info(`Super Admin created: ${user.email}`);
}

connectDatabase()
  .then(seed)
  .then(disconnectDatabase)
  .catch(async (err) => {
    logger.fatal({ err }, 'Seed failed');
    await disconnectDatabase();
    process.exit(1);
  });
