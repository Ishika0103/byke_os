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
import { HotelModel } from '../hotels/hotel.model';
import { RoleModel } from '../roles/role.model';
import { UserModel } from './user.model';

type LeanRoleRef = { _id: Types.ObjectId; name: string; code: string; permissions?: string[] };
type LeanHotelRef = { _id: Types.ObjectId; name: string; code: string };
type LeanUser = LeanBase & {
  name: string;
  email: string;
  roleId: Types.ObjectId;
  hotelIds: Types.ObjectId[];
};
type LeanUserWithRole = Omit<LeanUser, 'roleId' | 'hotelIds'> & {
  roleId: LeanRoleRef | null;
  hotelIds?: LeanHotelRef[];
};

const ROLE_POPULATE = [
  { path: 'roleId', select: 'name code permissions' },
  { path: 'hotelIds', select: 'name code', options: { sort: { name: 1 } } },
];

const toUserDto = (u: LeanUserWithRole): User => ({
  ...toBaseDto(u),
  name: u.name,
  email: u.email,
  role: u.roleId ? { id: String(u.roleId._id), name: u.roleId.name, code: u.roleId.code } : null,
  // Deleted hotels drop out of the populate (base-fields plugin).
  permissions: u.roleId?.permissions ?? [],
  hotels: (u.hotelIds ?? [])
    .filter(Boolean)
    .map((h) => ({ id: String(h._id), name: h.name, code: h.code })),
});

async function findOrThrow(id: string): Promise<LeanUser> {
  const user = await UserModel.findById(id).lean<LeanUser>();
  if (!user) throw AppError.notFound('User not found');
  return user;
}

/** Plan 06: only Super Admin can give someone the Super Admin role, or change a Super Admin. */
const NEED_SUPER_ADMIN = 'Only Super Admin can do this to a Super Admin';

async function assertAssignableRole(roleId: string, actorIsSuperAdmin: boolean) {
  const role = await RoleModel.findById(roleId).select('isActive').lean<{ isActive: boolean }>();
  if (!role) throw AppError.field('roleId', 'Role not found');
  if (!role.isActive) throw AppError.field('roleId', 'Role is inactive');
  if (!actorIsSuperAdmin && (await isSuperAdminRole(roleId))) {
    throw AppError.forbidden(NEED_SUPER_ADMIN);
  }
}

async function assertCanManage(user: LeanUser, actorIsSuperAdmin: boolean) {
  if (!actorIsSuperAdmin && (await isSuperAdminRole(String(user.roleId)))) {
    throw AppError.forbidden(NEED_SUPER_ADMIN);
  }
}

export async function isSuperAdminRole(roleId: string): Promise<boolean> {
  const role = await RoleModel.findById(roleId).select('code').lean<{ code: string }>();
  return role?.code === SUPER_ADMIN_ROLE_CODE;
}

/**
 * Plan 05: the hotels to save for a user with this role. Super Admin sees every hotel, so
 * none are stored; everyone else needs at least one existing (not deleted) hotel.
 */
async function resolveHotelIds(roleId: string, hotelIds: string[]): Promise<string[]> {
  if (await isSuperAdminRole(roleId)) return [];
  const unique = [...new Set(hotelIds)];
  if (unique.length === 0) throw AppError.field('hotelIds', 'Choose at least one hotel');
  const found = await HotelModel.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) throw AppError.field('hotelIds', 'Hotel not found');
  return unique;
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
    const { page, limit, q, isActive, roleId, hotelId, sort } = query;
    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (roleId) filter.roleId = roleId;
    if (hotelId) filter.hotelIds = hotelId;
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

  async create(
    input: CreateUserInput,
    actorId: string | null,
    actorIsSuperAdmin = false,
  ): Promise<User> {
    await assertAssignableRole(input.roleId, actorIsSuperAdmin);
    const hotelIds = await resolveHotelIds(input.roleId, input.hotelIds);
    await assertEmailFree(input.email);

    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      roleId: input.roleId,
      hotelIds,
      hashPassword: await hashPlainPassword(input.password),
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.getById(String(user._id));
  },

  async update(
    id: string,
    input: UpdateUserInput,
    actorId: string,
    actorIsSuperAdmin: boolean,
  ): Promise<User> {
    const user = await findOrThrow(id);
    await assertCanManage(user, actorIsSuperAdmin);
    const roleChanging = input.roleId !== undefined && input.roleId !== String(user.roleId);
    const deactivating = input.isActive === false && user.isActive;

    if (id === actorId && (deactivating || roleChanging)) {
      throw AppError.forbidden("You can't deactivate yourself or change your own role");
    }
    if (roleChanging) await assertAssignableRole(input.roleId!, actorIsSuperAdmin);
    if ((deactivating || roleChanging) && (await isLastActiveSuperAdmin(user))) {
      throw AppError.forbidden(
        'The last active Super Admin cannot be deactivated or moved to another role',
      );
    }
    if (input.email !== undefined && input.email !== user.email) {
      await assertEmailFree(input.email, id);
    }
    // Re-check hotels when they or the role change (e.g. moving away from Super Admin needs hotels).
    const set: Record<string, unknown> = { ...input };
    if (input.hotelIds !== undefined || roleChanging) {
      set.hotelIds = await resolveHotelIds(
        input.roleId ?? String(user.roleId),
        input.hotelIds ?? (user.hotelIds ?? []).map(String),
      );
    }

    await UserModel.updateOne({ _id: id }, { ...set, updatedBy: actorId }, { runValidators: true });
    return this.getById(id);
  },

  async remove(id: string, actorId: string, actorIsSuperAdmin: boolean): Promise<void> {
    if (id === actorId) throw AppError.forbidden("You can't delete yourself");
    const user = await findOrThrow(id);
    await assertCanManage(user, actorIsSuperAdmin);
    if (await isLastActiveSuperAdmin(user)) {
      throw AppError.forbidden('The last active Super Admin cannot be deleted');
    }
    await UserModel.updateOne({ _id: id }, softDeleteUpdate(actorId));
  },

  /** Admin sets a new password for a user. */
  async resetPassword(
    id: string,
    newPassword: string,
    actorId: string,
    actorIsSuperAdmin: boolean,
  ): Promise<void> {
    const user = await findOrThrow(id);
    await assertCanManage(user, actorIsSuperAdmin);
    assertPasswordNotEmail(newPassword, user.email);
    await UserModel.updateOne(
      { _id: id },
      { hashPassword: await hashPlainPassword(newPassword), updatedBy: actorId },
    );
  },
};

export { assertPasswordNotEmail };
