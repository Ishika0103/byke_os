import type { ConsumptionModule } from '@byke-os/shared';
import { type LeanBase, toBaseDto } from '../../db/lean-types';
import { ConsumptionModuleModel } from './consumption-module.model';

type LeanModule = LeanBase & { name: string; code: string; sortOrder: number };

export const consumptionModuleService = {
  /** The active modules in column order (a short fixed list, so no paging). */
  async list(): Promise<ConsumptionModule[]> {
    const modules = await ConsumptionModuleModel.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean<LeanModule[]>();
    return modules.map((m) => ({
      ...toBaseDto(m),
      name: m.name,
      code: m.code,
      sortOrder: m.sortOrder,
    }));
  },
};
