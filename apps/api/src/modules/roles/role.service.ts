import {
  SUPER_ADMIN_ROLE_CODE,
  type CreateRoleInput,
  type Paginated,
  type Role,
  type RoleListQuery,
  type RoleSummary,
  type UpdateRoleInput,
} from '@byke-os/shared';
import { type LeanBase, softDeleteUpdate, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { escapeRegex, toSort } from '../../utils/query';
import { UserModel } from '../users/user.model';
import { CASE_INSENSITIVE, RoleModel } from './role.model';

type LeanRole = LeanBase & { name: string; code: string; permissions?: string[] };

const toRoleDto = (r: LeanRole): Role => ({
  ...toBaseDto(r),
  name: r.name,
  code: r.code,
  permissions: r.permissions ?? [],
});

async function findOrThrow(id: string): Promise<LeanRole> {
  const role = await RoleModel.findById(id).lean<LeanRole>();
  if (!role) throw AppError.notFound('Role not found');
  return role;
}

/** A role is "in use" while any non-deleted user (active or not) has it. */
const isInUse = (id: string) => UserModel.exists({ roleId: id }).then(Boolean);

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await RoleModel.findOne({ name, ...(exceptId && { _id: { $ne: exceptId } }) })
    .collation(CASE_INSENSITIVE)
    .select('_id')
    .lean();
  if (clash) throw AppError.conflict('NAME_TAKEN', 'A role with this name already exists');
}

export const roleService = {
  /** Names only (no permissions), for pickers in the user screens. */
  async options(): Promise<RoleSummary[]> {
    const roles = await RoleModel.find({ isActive: true })
      .collation(CASE_INSENSITIVE)
      .sort({ name: 1 })
      .select('name code')
      .lean<{ _id: unknown; name: string; code: string }[]>();
    return roles.map((r) => ({ id: String(r._id), name: r.name, code: r.code }));
  },

  async list(query: RoleListQuery): Promise<Paginated<Role>> {
    const { page, limit, q, isActive, sort } = query;
    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { code: rx }];
    }

    const [items, total] = await Promise.all([
      RoleModel.find(filter)
        .collation(CASE_INSENSITIVE)
        .sort(toSort(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanRole[]>(),
      RoleModel.countDocuments(filter),
    ]);
    return { items: items.map(toRoleDto), page, limit, total };
  },

  async getById(id: string): Promise<Role> {
    return toRoleDto(await findOrThrow(id));
  },

  async create(input: CreateRoleInput, actorId: string): Promise<Role> {
    if (await RoleModel.exists({ code: input.code })) {
      throw AppError.conflict('CODE_TAKEN', 'A role with this code already exists');
    }
    await assertNameFree(input.name);

    const role = await RoleModel.create({ ...input, createdBy: actorId, updatedBy: actorId });
    return this.getById(String(role._id));
  },

  async update(id: string, input: UpdateRoleInput, actorId: string): Promise<Role> {
    const role = await findOrThrow(id);
    if (input.permissions !== undefined && role.code === SUPER_ADMIN_ROLE_CODE) {
      throw AppError.forbidden("Super Admin's permissions can't be changed");
    }

    if (input.name !== undefined && input.name !== role.name) await assertNameFree(input.name, id);
    if (input.isActive === false && role.isActive && (await isInUse(id))) {
      throw AppError.conflict('ROLE_IN_USE', 'Role is assigned to users; reassign them first');
    }

    await RoleModel.updateOne(
      { _id: id },
      { ...input, updatedBy: actorId },
      { runValidators: true },
    );
    return this.getById(id);
  },

  async remove(id: string, actorId: string): Promise<void> {
    await findOrThrow(id);
    if (await isInUse(id)) {
      throw AppError.conflict('ROLE_IN_USE', 'Role is assigned to users; reassign them first');
    }
    await RoleModel.updateOne({ _id: id }, softDeleteUpdate(actorId));
  },
};
