import type { Types } from 'mongoose';

/**
 * Shape of the common fields on a `.lean()` result. They're added by the base-fields
 * plugin at runtime, so Mongoose's inferred schema types don't include them.
 */
export type LeanBase = {
  _id: Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Common fields as exposed by the API. */
export function toBaseDto(doc: LeanBase) {
  return {
    id: String(doc._id),
    isActive: doc.isActive,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Fields to set when soft-deleting (Plan 01a §1). updatedAt is set automatically by timestamps. */
export function softDeleteUpdate(actorId: string) {
  return { isDeleted: true, updatedBy: actorId };
}
