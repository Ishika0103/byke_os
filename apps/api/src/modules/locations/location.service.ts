import type { Location, LocationListQuery, Paginated } from '@byke-os/shared';
import { type LeanBase, toBaseDto } from '../../db/lean-types';
import { escapeRegex, toSort } from '../../utils/query';
import { CASE_INSENSITIVE } from '../roles/role.model';
import { LocationModel } from './location.model';

type LeanLocation = LeanBase & {
  name: string;
  state: string;
  slug: string;
  bykeId?: number | null;
};

const toLocationDto = (l: LeanLocation): Location => ({
  ...toBaseDto(l),
  name: l.name,
  state: l.state,
  slug: l.slug,
  bykeId: l.bykeId ?? null,
});

export const locationService = {
  async list(query: LocationListQuery): Promise<Paginated<Location>> {
    const { page, limit, q, isActive, sort } = query;
    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { state: rx }];
    }
    const [items, total] = await Promise.all([
      LocationModel.find(filter)
        .collation(CASE_INSENSITIVE)
        .sort(toSort(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanLocation[]>(),
      LocationModel.countDocuments(filter),
    ]);
    return { items: items.map(toLocationDto), page, limit, total };
  },
};
