import type {
  CreateDepartmentInput,
  Department,
  DepartmentListQuery,
  Paginated,
  UpdateDepartmentInput,
} from '@byke-os/shared';
import { type LeanBase, softDeleteUpdate, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { codeFromName, firstFreeCode } from '../../utils/code';
import { escapeRegex, toSort } from '../../utils/query';
import { CASE_INSENSITIVE } from '../roles/role.model';
import { UserModel } from '../users/user.model';
import { DepartmentModel } from './department.model';

type LeanDepartment = LeanBase & { name: string; code: string };

const toDto = (d: LeanDepartment): Department => ({
  ...toBaseDto(d),
  name: d.name,
  code: d.code,
});

async function findOrThrow(id: string): Promise<LeanDepartment> {
  const dept = await DepartmentModel.findById(id).lean<LeanDepartment>();
  if (!dept) throw AppError.notFound('Department not found');
  return dept;
}

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await DepartmentModel.findOne({
    name,
    ...(exceptId && { _id: { $ne: exceptId } }),
  })
    .collation(CASE_INSENSITIVE)
    .select('_id')
    .lean();
  if (clash) throw AppError.conflict('NAME_TAKEN', 'A department with this name already exists');
}

export const departmentService = {
  async list(query: DepartmentListQuery): Promise<Paginated<Department>> {
    const { page, limit, q, isActive, sort } = query;
    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { code: rx }];
    }
    const [items, total] = await Promise.all([
      DepartmentModel.find(filter)
        .collation(CASE_INSENSITIVE)
        .sort(toSort(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanDepartment[]>(),
      DepartmentModel.countDocuments(filter),
    ]);
    return { items: items.map(toDto), page, limit, total };
  },

  async getById(id: string): Promise<Department> {
    return toDto(await findOrThrow(id));
  },

  async create(input: CreateDepartmentInput, actorId: string): Promise<Department> {
    await assertNameFree(input.name);
    const code = await firstFreeCode(codeFromName(input.name), (c) =>
      DepartmentModel.exists({ code: c }),
    );
    const dept = await DepartmentModel.create({
      ...input,
      code,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.getById(String(dept._id));
  },

  async update(id: string, input: UpdateDepartmentInput, actorId: string): Promise<Department> {
    const dept = await findOrThrow(id);
    if (input.name !== undefined && input.name !== dept.name) await assertNameFree(input.name, id);
    await DepartmentModel.updateOne(
      { _id: id },
      { ...input, updatedBy: actorId },
      { runValidators: true },
    );
    return this.getById(id);
  },

  async remove(id: string, actorId: string): Promise<void> {
    await findOrThrow(id);
    if (await UserModel.exists({ departmentIds: id })) {
      throw AppError.conflict(
        'DEPARTMENT_IN_USE',
        'Users belong to this department; move them first',
      );
    }
    await DepartmentModel.updateOne({ _id: id }, softDeleteUpdate(actorId));
  },
};
