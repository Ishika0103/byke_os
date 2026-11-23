import type { BaseEntity } from './common';
import type { DepartmentSummary } from './department';

/** Plan 09 §7: what kind of work a predefined task title is. A fixed list. */
export const TASK_MASTER_TYPES = ['service', 'complaint', 'order', 'request'] as const;
export type TaskMasterType = (typeof TASK_MASTER_TYPES)[number];

export const TASK_MASTER_TYPE_LABEL: Record<TaskMasterType, string> = {
  service: 'Service',
  complaint: 'Complaint',
  order: 'Order',
  request: 'Request',
};

/** A predefined task title (seeded; no screen to edit them). */
export type TaskMaster = BaseEntity & {
  title: string;
  type: TaskMasterType;
  /** Default department for this title; the user can change it when creating a task. */
  department: DepartmentSummary | null;
};
