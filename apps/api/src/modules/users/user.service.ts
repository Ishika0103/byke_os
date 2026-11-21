import type { Types } from 'mongoose';
import {
  type CreateUserInput,
  type Paginated,
  SUPER_ADMIN_ROLE_CODE,
  type UpdateUserInput,
  type User,
  type UserListQuery,
} from '@byke-os/shared';
import { type LeanBase, softDeleteUpdate, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { escapeRegex, toSort } from '../../utils/query';
import { hashPlainPassword } from '../auth/password';
import { RoleModel } from '../roles/role.model';
import { UserModel } from './user.model';

type LeanRoleRef = { _id: Types.ObjectId; name: string; code: string };
type LeanUser = LeanBase & {
  name: string;
  email: string;
  roleId: Types.ObjectId;
};
type LeanUserWithRole = Omit<LeanUser, 'roleId'> & { roleId: LeanRoleRef | null };

const ROLE_POPULATE = { path: 'roleId', select: 'name code' } as const;

const toUserDto = (u: LeanUserWithRole): User => ({
  ...toBaseDto(u),
  name: u.name,
  email: u.email,
  role: u.roleId ? { id: String(u.roleId._id), name: u.roleId.name, code: u.roleId.code } : null,
});

async function findOrThrow(id: string): Promise<LeanUser> {
  const user = await UserModel.findById(id).lean<LeanUser>();
  if (!user) throw AppError.notFound('User not found');
  return user;
}

async function assertAssignableRole(roleId: string) {
  const role = await RoleModel.findById(roleId).select('isActive').lean<{ isActive: boolean }>();
  if (!role) throw AppError.field('roleId', 'Role not found');
  if (!role.isActive) throw AppError.field('roleId', 'Role is inactive');
}

async function assertEmailFree(email: string, exceptId?: string) {
  const clash = await UserModel.exists({ email, ...(exceptId && { _id: { $ne: exceptId } }) });
  if (clash) throw AppError.conflict('EMAIL_TAKEN', 'Email already registered');
}

function assertPasswordNotEmail(password: string, email: string) {
  if (password.toLowerCase() === email) {
    throw AppError.field('newPassword', 'Password must not be the same as the email');
  }
}

/** True if `user` is the only active, non-deleted user holding the SUPER_ADMIN role. */
async function isLastActiveSuperAdmin(user: LeanUser): Promise<boolean> {
  if (!user.isActive) return false;
  const role = await RoleModel.findById(user.roleId).select('code').lean<{ code: string }>();
  if (role?.code !== SUPER_ADMIN_ROLE_CODE) return false;
  const others = await UserModel.countDocuments({
    roleId: user.roleId,
    isActive: true,
    _id: { $ne: user._id },
  });
  return others === 0;
}

export const userService = {
  async list(query: UserListQuery): Promise<Paginated<User>> {
    const { page, limit, q, isActive, roleId, sort } = query;
    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (roleId) filter.roleId = roleId;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .collation({ locale: 'en', strength: 2 })
        .sort(toSort(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(ROLE_POPULATE)
        .lean<LeanUserWithRole[]>(),
      UserModel.countDocuments(filter),
    ]);
    return { items: items.map(toUserDto), page, limit, total };
  },

  async getById(id: string): Promise<User> {
    const user = await UserModel.findById(id).populate(ROLE_POPULATE).lean<LeanUserWithRole>();
    if (!user) throw AppError.notFound('User not found');
    return toUserDto(user);
  },

  async create(input: CreateUserInput, actorId: string | null): Promise<User> {
    await assertAssignableRole(input.roleId);
    await assertEmailFree(input.email);

    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      roleId: input.roleId,
      hashPassword: await hashPlainPassword(input.password),
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.getById(String(user._id));
  },

  async update(id: string, input: UpdateUserInput, actorId: string): Promise<User> {
    const user = await findOrThrow(id);
    const roleChanging = input.roleId !== undefined && input.roleId !== String(user.roleId);
    const deactivating = input.isActive === false && user.isActive;

    if (id === actorId && (deactivating || roleChanging)) {
      throw AppError.forbidden("You can't deactivate yourself or change your own role");
    }
    if (roleChanging) await assertAssignableRole(input.roleId!);
    if ((deactivating || roleChanging) && (await isLastActiveSuperAdmin(user))) {
      throw AppError.forbidden(
        'The last active Super Admin cannot be deactivated or moved to another role',
      );
    }
    if (input.email !== undefined && input.email !== user.email) {
      await assertEmailFree(input.email, id);
    }

    await UserModel.updateOne(
      { _id: id },
      { ...input, updatedBy: actorId },
      { runValidators: true },
    );
    return this.getById(id);
  },

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) throw AppError.forbidden("You can't delete yourself");
    const user = await findOrThrow(id);
    if (await isLastActiveSuperAdmin(user)) {
      throw AppError.forbidden('The last active Super Admin cannot be deleted');
    }
    await UserModel.updateOne({ _id: id }, softDeleteUpdate(actorId));
  },

  /** Admin sets a new password for a user. */
  async resetPassword(id: string, newPassword: string, actorId: string): Promise<void> {
    const user = await findOrThrow(id);
    assertPasswordNotEmail(newPassword, user.email);
    await UserModel.updateOne(
      { _id: id },
      { hashPassword: await hashPlainPassword(newPassword), updatedBy: actorId },
    );
  },
};

export { assertPasswordNotEmail };
