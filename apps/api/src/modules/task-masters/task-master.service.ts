import type { Types } from 'mongoose';
import type { DepartmentSummary, TaskMaster, TaskMasterType } from '@byke-os/shared';
import { type LeanBase, toBaseDto } from '../../db/lean-types';
import { DepartmentModel } from '../departments/department.model';
import { TaskMasterModel } from './task-master.model';

type LeanTaskMaster = LeanBase & {
  title: string;
  type: TaskMasterType;
  departmentId: Types.ObjectId | null;
};

export const taskMasterService = {
  /** All active predefined titles, A to Z (a short fixed list, so no paging). */
  async list(): Promise<TaskMaster[]> {
    const masters = await TaskMasterModel.find({ isActive: true })
      .collation({ locale: 'en', strength: 2 })
      .sort({ title: 1 })
      .lean<LeanTaskMaster[]>();
    const ids = [
      ...new Set(masters.flatMap((m) => (m.departmentId ? [String(m.departmentId)] : []))),
    ];
    const departments = ids.length
      ? await DepartmentModel.find({ _id: { $in: ids }, isDeleted: { $in: [true, false] } })
          .select('name code')
          .lean<{ _id: Types.ObjectId; name: string; code: string }[]>()
      : [];
    const byId = new Map<string, DepartmentSummary>(
      departments.map((d) => [String(d._id), { id: String(d._id), name: d.name, code: d.code }]),
    );
    return masters.map((m) => ({
      ...toBaseDto(m),
      title: m.title,
      type: m.type,
      department: m.departmentId ? (byId.get(String(m.departmentId)) ?? null) : null,
    }));
  },
};
