import { z } from 'zod';
import { DEPARTMENT_KEYS, type DepartmentKey } from '../data/departments';
import { type BaseEntity, listQuerySchema, nameSchema, objectIdSchema } from './common';

/** Plan 04 §3. */
export const TASK_STAGES = [
  'pending',
  'in_progress',
  'blocked',
  'done',
  'verified',
  'cancelled',
] as const;
export type TaskStage = (typeof TASK_STAGES)[number];

/** Stages where the work isn't finished yet (can be late, can be edited). */
export const OPEN_STAGES: readonly TaskStage[] = ['pending', 'in_progress', 'blocked'];
/** Final stages: nothing more can happen. */
export const CLOSED_STAGES: readonly TaskStage[] = ['verified', 'cancelled'];

export const TASK_ACTIONS = [
  'start',
  'block',
  'unblock',
  'done',
  'verify',
  'send_back',
  'cancel',
] as const;
export type TaskAction = (typeof TASK_ACTIONS)[number];

/** The stages each action can start from. */
export const ACTION_FROM: Record<TaskAction, readonly TaskStage[]> = {
  start: ['pending'],
  block: ['pending', 'in_progress'],
  unblock: ['blocked'],
  done: ['in_progress'],
  verify: ['done'],
  send_back: ['done'],
  cancel: ['pending', 'in_progress', 'blocked'],
};

/** Actions that need a reason in `note`. */
export const REASON_ACTIONS: readonly TaskAction[] = ['block', 'send_back', 'cancel'];

/** What each log row records. */
export const TASK_UPDATE_KINDS = [
  'created',
  'edited',
  'started',
  'blocked',
  'unblocked',
  'done',
  'verified',
  'sent_back',
  'cancelled',
] as const;
export type TaskUpdateKind = (typeof TASK_UPDATE_KINDS)[number];

export const MAX_TASK_PHOTOS = 3;

/** A photo returned by the upload endpoint: "/uploads/<random>.jpg". */
export const uploadUrlSchema = z
  .string()
  .regex(/^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/, 'Invalid photo');

const descriptionSchema = z.string().trim().max(1000, 'At most 1000 characters');
const noteSchema = z.string().trim().max(1000, 'At most 1000 characters');
const dueAtSchema = z.iso.datetime({ offset: true, message: 'Choose a due time' });

export const createTaskSchema = z
  .object({
    title: nameSchema(3, 120),
    description: descriptionSchema.nullable().optional(),
    department: z.enum(DEPARTMENT_KEYS, { message: 'Choose a department' }),
    roomId: objectIdSchema.nullable().optional(),
    assigneeId: objectIdSchema.nullable().optional(),
    dueAt: dueAtSchema,
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: nameSchema(3, 120),
    description: descriptionSchema.nullable(),
    department: z.enum(DEPARTMENT_KEYS, { message: 'Choose a department' }),
    roomId: objectIdSchema.nullable(),
    assigneeId: objectIdSchema.nullable(),
    dueAt: dueAtSchema,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/** One lifecycle step. Reasons and proof are checked here so the app shows the same errors. */
export const taskActionSchema = z
  .object({
    action: z.enum(TASK_ACTIONS),
    note: noteSchema.optional(),
    photos: z
      .array(uploadUrlSchema)
      .max(MAX_TASK_PHOTOS, `At most ${MAX_TASK_PHOTOS} photos`)
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasNote = !!v.note;
    const hasPhotos = !!v.photos?.length;
    if (REASON_ACTIONS.includes(v.action) && !hasNote) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Give a reason' });
    }
    if (v.action === 'done' && !hasNote && !hasPhotos) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Add a photo or a note as proof' });
    }
    if (v.action !== 'done' && hasPhotos) {
      ctx.addIssue({
        code: 'custom',
        path: ['photos'],
        message: 'Photos are only for marking done',
      });
    }
  });

const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const TASK_VIEWS = ['open', 'waiting', 'closed', 'all'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const taskListQuerySchema = listQuerySchema
  .extend({
    view: z.enum(TASK_VIEWS).default('open'),
    department: z.enum(DEPARTMENT_KEYS).optional(),
    /** A user id, or "me" for the signed-in user. */
    assigneeId: z.union([objectIdSchema, z.literal('me')]).optional(),
    roomId: objectIdSchema.optional(),
    overdue: booleanString.optional(),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskActionInput = z.infer<typeof taskActionSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export type PersonSummary = { id: string; name: string };

export type Task = BaseEntity & {
  hotelId: string;
  title: string;
  description: string | null;
  department: DepartmentKey;
  room: { id: string; roomNumber: string } | null;
  assignee: PersonSummary | null;
  dueAt: string;
  stage: TaskStage;
  /** Set only while blocked. */
  blockedFrom: TaskStage | null;
  blockedReason: string | null;
  doneBy: PersonSummary | null;
  doneAt: string | null;
  verifiedBy: PersonSummary | null;
  verifiedAt: string | null;
  /** Past its due time and still open (not stored). */
  isOverdue: boolean;
};

export type TaskUpdate = {
  id: string;
  kind: TaskUpdateKind;
  fromStage: TaskStage | null;
  toStage: TaskStage | null;
  note: string | null;
  photos: { url: string }[];
  /** Only for "edited": readable before / after values per field. */
  changes: Record<string, { from: string | null; to: string | null }> | null;
  by: PersonSummary | null;
  createdAt: string;
};

export type TaskDetail = Task & { updates: TaskUpdate[] };

export type TaskSummary = {
  overdue: number;
  open: number;
  waiting: number;
  closedToday: number;
};
