import { z } from 'zod';
import type { DepartmentSummary } from './department';
import { type BaseEntity, listQuerySchema, nameSchema, objectIdSchema } from './common';

/** Plan 04 §3. */
export const TASK_STAGES = ['pending', 'in_progress', 'done', 'verified', 'cancelled'] as const;
export type TaskStage = (typeof TASK_STAGES)[number];

/** Stages where the work isn't finished yet (can be late, can be edited). */
export const OPEN_STAGES: readonly TaskStage[] = ['pending', 'in_progress'];
/** Final stages: nothing more can happen. */
export const CLOSED_STAGES: readonly TaskStage[] = ['verified', 'cancelled'];

export const TASK_ACTIONS = ['start', 'done', 'verify', 'send_back', 'cancel'] as const;
export type TaskAction = (typeof TASK_ACTIONS)[number];

/** The stages each action can start from. */
export const ACTION_FROM: Record<TaskAction, readonly TaskStage[]> = {
  start: ['pending'],
  done: ['in_progress'],
  verify: ['done'],
  send_back: ['done'],
  cancel: ['pending', 'in_progress'],
};

/** Actions that need a reason in `note`. */
export const REASON_ACTIONS: readonly TaskAction[] = ['send_back', 'cancel'];

/** What each log row records. 'blocked' / 'unblocked' are legacy: old rows stay readable, never created. */
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
export const MAX_TASK_ROOMS = 100;

/**
 * A photo returned by the upload endpoint: "/uploads/<random>.jpg" (local disk) or
 * "https://<media domain>/.../<random>.jpg" (S3). The API also checks it is one it issued.
 */
export const uploadUrlSchema = z
  .string()
  .max(500)
  .regex(
    /^(\/uploads\/|https:\/\/[^\s/]+\/([^\s/]+\/)*)[a-f0-9-]{36}\.(jpg|png|webp)$/,
    'Invalid photo',
  );

const descriptionSchema = z.string().trim().max(1000, 'At most 1000 characters');
const noteSchema = z.string().trim().max(1000, 'At most 1000 characters');
const dueAtSchema = z.iso.datetime({ offset: true, message: 'Choose a due time' });

export const createTaskSchema = z
  .object({
    title: nameSchema(3, 120),
    description: descriptionSchema.nullable().optional(),
    /** The predefined title this task was picked from; null/absent for "Other" (typed title). */
    taskMasterId: objectIdSchema.nullable().optional(),
    departmentId: z.string({ error: 'Choose a department' }).pipe(objectIdSchema),
    /** One task is created per room; none = a single task without a room. */
    roomIds: z
      .array(objectIdSchema)
      .max(MAX_TASK_ROOMS, `At most ${MAX_TASK_ROOMS} rooms`)
      .optional(),
    assigneeIds: z.array(objectIdSchema).max(20, 'At most 20 people').optional(),
    /** The only person who can verify the work; not one of the assignees. */
    verifierId: z.string({ error: 'Choose a verifier' }).pipe(objectIdSchema),
    dueAt: dueAtSchema,
  })
  .strict()
  .refine((v) => !v.verifierId || !v.assigneeIds?.includes(v.verifierId), {
    path: ['verifierId'],
    message: 'The verifier cannot be one of the assignees',
  });

export const updateTaskSchema = z
  .object({
    title: nameSchema(3, 120),
    description: descriptionSchema.nullable(),
    departmentId: objectIdSchema,
    roomId: objectIdSchema.nullable(),
    assigneeIds: z.array(objectIdSchema).max(20, 'At most 20 people'),
    verifierId: objectIdSchema,
    dueAt: dueAtSchema,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .refine((v) => !v.verifierId || !v.assigneeIds?.includes(v.verifierId), {
    path: ['verifierId'],
    message: 'The verifier cannot be one of the assignees',
  });

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
    if (v.action !== 'done' && v.action !== 'verify' && hasPhotos) {
      ctx.addIssue({
        code: 'custom',
        path: ['photos'],
        message: 'Photos are only for marking done or verifying',
      });
    }
  });

const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const TASK_VIEWS = ['open', 'waiting', 'closed', 'all'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const taskListQuerySchema = listQuerySchema
  .extend({
    view: z.enum(TASK_VIEWS).default('open'),
    departmentId: objectIdSchema.optional(),
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
  /** The predefined title it came from; null when typed ("Other"). */
  taskMasterId: string | null;
  /** Tasks created together for several rooms share a group id. */
  groupId: string;
  department: DepartmentSummary | null;
  room: { id: string; roomNumber: string } | null;
  /** Anyone listed can start and mark it done. Empty = unassigned. */
  assignees: PersonSummary[];
  dueAt: string;
  stage: TaskStage;
  /** The only person who can verify (and send back) the work. */
  verifier: PersonSummary;
  /** True when the signed-in user is the verifier and the task is done (not stored). */
  canVerify: boolean;
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

/** Response of creating tasks: one task per room (or one without a room), in one group. */
export type CreatedTasks = { groupId: string; tasks: Task[] };

export type TaskDetail = Task & { updates: TaskUpdate[] };

export type TaskSummary = {
  overdue: number;
  open: number;
  waiting: number;
  closedToday: number;
};
