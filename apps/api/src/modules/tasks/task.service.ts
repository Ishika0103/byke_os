import { Types } from 'mongoose';
import {
  ACTION_FROM,
  CLOSED_STAGES,
  OPEN_STAGES,
  TASK_STAGES,
  departmentLabel,
  type CreateTaskInput,
  type DepartmentKey,
  type Paginated,
  type PersonSummary,
  type Task,
  type TaskAction,
  type TaskActionInput,
  type TaskDetail,
  type TaskListQuery,
  type TaskStage,
  type TaskSummary,
  type TaskUpdate,
  type TaskUpdateKind,
  type TaskView,
  type UpdateTaskInput,
} from '@byke-os/shared';
import { type LeanBase, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { escapeRegex } from '../../utils/query';
import { RoomModel } from '../rooms/room.model';
import { UserModel } from '../users/user.model';
import { isSuperAdminRole } from '../users/user.service';
import { TaskModel, TaskUpdateModel } from './task.model';

type Id = Types.ObjectId;

type LeanTask = LeanBase & {
  hotelId: Id;
  title: string;
  description: string | null;
  department: DepartmentKey;
  roomId: Id | null;
  assigneeId: Id | null;
  dueAt: Date;
  stage: TaskStage;
  blockedFrom: TaskStage | null;
  blockedReason: string | null;
  doneBy: Id | null;
  doneAt: Date | null;
  verifiedBy: Id | null;
  verifiedAt: Date | null;
};

type LeanUpdate = {
  _id: Id;
  kind: TaskUpdateKind;
  fromStage: TaskStage | null;
  toStage: TaskStage | null;
  note: string | null;
  photos: { url: string }[];
  changes: TaskUpdate['changes'];
  createdBy: Id | null;
  createdAt: Date;
};

const STAGE_LABEL: Record<TaskStage, string> = {
  pending: 'pending',
  in_progress: 'in progress',
  blocked: 'blocked',
  done: 'done',
  verified: 'verified',
  cancelled: 'cancelled',
};

const ACTION_KIND: Record<TaskAction, TaskUpdateKind> = {
  start: 'started',
  block: 'blocked',
  unblock: 'unblocked',
  done: 'done',
  verify: 'verified',
  send_back: 'sent_back',
  cancel: 'cancelled',
};

const VIEW_STAGES: Record<TaskView, readonly TaskStage[]> = {
  open: OPEN_STAGES,
  waiting: ['done'],
  closed: CLOSED_STAGES,
  all: TASK_STAGES,
};

const isOpen = (stage: TaskStage) => OPEN_STAGES.includes(stage);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const key = (id: Id | null) => (id ? String(id) : null);

const invalidStage = (message: string) => AppError.conflict('INVALID_STAGE', message);
const changedMeanwhile = () =>
  invalidStage('Someone else just changed this task. Refresh and try again.');

/** Names for user ids, including deleted users (history must still show who did what). */
async function peopleById(ids: (Id | null)[]): Promise<Map<string, PersonSummary>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const users = await UserModel.find({ _id: { $in: unique }, isDeleted: { $in: [true, false] } })
    .select('name')
    .lean<{ _id: Id; name: string }[]>();
  return new Map(users.map((u) => [String(u._id), { id: String(u._id), name: u.name }]));
}

async function roomsById(
  ids: (Id | null)[],
): Promise<Map<string, { id: string; roomNumber: string }>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const rooms = await RoomModel.find({ _id: { $in: unique }, isDeleted: { $in: [true, false] } })
    .select('roomNumber')
    .lean<{ _id: Id; roomNumber: string }[]>();
  return new Map(
    rooms.map((r) => [String(r._id), { id: String(r._id), roomNumber: r.roomNumber }]),
  );
}

async function toDtos(tasks: LeanTask[]): Promise<Task[]> {
  const [people, rooms] = await Promise.all([
    peopleById(tasks.flatMap((t) => [t.assigneeId, t.doneBy, t.verifiedBy])),
    roomsById(tasks.map((t) => t.roomId)),
  ]);
  const person = (id: Id | null) => (id ? (people.get(String(id)) ?? null) : null);
  const now = new Date();
  return tasks.map((t) => ({
    ...toBaseDto(t),
    hotelId: String(t.hotelId),
    title: t.title,
    description: t.description ?? null,
    department: t.department,
    room: t.roomId ? (rooms.get(String(t.roomId)) ?? null) : null,
    assignee: person(t.assigneeId),
    dueAt: t.dueAt.toISOString(),
    stage: t.stage,
    blockedFrom: t.blockedFrom ?? null,
    blockedReason: t.blockedReason ?? null,
    doneBy: person(t.doneBy),
    doneAt: iso(t.doneAt),
    verifiedBy: person(t.verifiedBy),
    verifiedAt: iso(t.verifiedAt),
    isOverdue: isOpen(t.stage) && t.dueAt < now,
  }));
}

async function findOrThrow(hotelId: string, id: string): Promise<LeanTask> {
  const task = await TaskModel.findOne({ _id: id, hotelId }).lean<LeanTask>();
  if (!task) throw AppError.notFound('Task not found');
  return task;
}

async function assertRoom(hotelId: string, roomId: string | null | undefined) {
  if (!roomId) return;
  if (!(await RoomModel.exists({ _id: roomId, hotelId }))) {
    throw AppError.field('roomId', 'Room not found in this hotel');
  }
}

/** The assignee must be active and work at this hotel (Plan 05; Super Admin works everywhere). */
async function assertAssignee(hotelId: string, userId: string | null | undefined) {
  if (!userId) return;
  const user = await UserModel.findOne({ _id: userId, isActive: true })
    .select('roleId hotelIds')
    .lean<{ roleId: Id; hotelIds?: Id[] }>();
  if (!user) throw AppError.field('assigneeId', 'User not found or inactive');
  const atHotel = (user.hotelIds ?? []).some((h) => String(h) === hotelId);
  if (!atHotel && !(await isSuperAdminRole(String(user.roleId)))) {
    throw AppError.field('assigneeId', 'This person is not added to this hotel');
  }
}

function log(
  task: { _id: Id; hotelId: Id },
  kind: TaskUpdateKind,
  actorId: string,
  extra: Partial<Pick<LeanUpdate, 'fromStage' | 'toStage' | 'note' | 'photos' | 'changes'>> = {},
) {
  return TaskUpdateModel.create({
    hotelId: task.hotelId,
    taskId: task._id,
    kind,
    ...extra,
    createdBy: actorId,
    updatedBy: actorId,
  });
}

/** Midnight in India (all Byke hotels), as a Date. */
function startOfTodayIndia(now = new Date()): Date {
  const offset = 330 * 60_000;
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

export const taskService = {
  async list(hotelId: string, query: TaskListQuery, actorId: string): Promise<Paginated<Task>> {
    const { page, limit, q, view, department, assigneeId, roomId, overdue } = query;
    let stages = VIEW_STAGES[view];
    const filter: Record<string, unknown> = { hotelId };
    if (overdue) {
      stages = stages.filter(isOpen);
      filter.dueAt = { $lt: new Date() };
    }
    filter.stage = { $in: stages };
    if (department) filter.department = department;
    if (assigneeId) filter.assigneeId = assigneeId === 'me' ? actorId : assigneeId;
    if (roomId) filter.roomId = roomId;
    if (q) filter.title = new RegExp(escapeRegex(q), 'i');

    // Open work: soonest (or most late) first. Closed work: most recent first.
    const sort: Record<string, 1 | -1> =
      view === 'closed' ? { updatedAt: -1, _id: -1 } : { dueAt: 1, _id: 1 };

    const [items, total] = await Promise.all([
      TaskModel.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanTask[]>(),
      TaskModel.countDocuments(filter),
    ]);
    return { items: await toDtos(items), page, limit, total };
  },

  async summary(hotelId: string): Promise<TaskSummary> {
    const now = new Date();
    const open = { hotelId, stage: { $in: OPEN_STAGES } };
    const [overdue, openCount, waiting, closedToday] = await Promise.all([
      TaskModel.countDocuments({ ...open, dueAt: { $lt: now } }),
      TaskModel.countDocuments(open),
      TaskModel.countDocuments({ hotelId, stage: 'done' }),
      TaskModel.countDocuments({
        hotelId,
        stage: 'verified',
        verifiedAt: { $gte: startOfTodayIndia(now) },
      }),
    ]);
    return { overdue, open: openCount, waiting, closedToday };
  },

  async getById(hotelId: string, id: string): Promise<TaskDetail> {
    const task = await findOrThrow(hotelId, id);
    const updates = await TaskUpdateModel.find({ taskId: task._id })
      .sort({ createdAt: 1, _id: 1 })
      .lean<LeanUpdate[]>();
    const [[dto], people] = await Promise.all([
      toDtos([task]),
      peopleById(updates.map((u) => u.createdBy)),
    ]);
    return {
      ...dto,
      updates: updates.map((u) => ({
        id: String(u._id),
        kind: u.kind,
        fromStage: u.fromStage ?? null,
        toStage: u.toStage ?? null,
        note: u.note ?? null,
        photos: (u.photos ?? []).map((p) => ({ url: p.url })),
        changes: u.changes ?? null,
        by: u.createdBy ? (people.get(String(u.createdBy)) ?? null) : null,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  },

  async create(hotelId: string, input: CreateTaskInput, actorId: string): Promise<TaskDetail> {
    await Promise.all([
      assertRoom(hotelId, input.roomId),
      assertAssignee(hotelId, input.assigneeId),
    ]);
    const task = await TaskModel.create({
      ...input,
      dueAt: new Date(input.dueAt),
      hotelId,
      stage: 'pending',
      createdBy: actorId,
      updatedBy: actorId,
    });
    await log(task, 'created', actorId, { toStage: 'pending' });
    return this.getById(hotelId, String(task._id));
  },

  /** Edits the details of an open task; each changed field is logged with before / after. */
  async update(
    hotelId: string,
    id: string,
    input: UpdateTaskInput,
    actorId: string,
  ): Promise<TaskDetail> {
    const task = await findOrThrow(hotelId, id);
    if (!isOpen(task.stage)) {
      throw invalidStage(`A ${STAGE_LABEL[task.stage]} task can't be edited`);
    }
    if (input.roomId !== undefined && input.roomId !== key(task.roomId)) {
      await assertRoom(hotelId, input.roomId);
    }
    if (input.assigneeId !== undefined && input.assigneeId !== key(task.assigneeId)) {
      await assertAssignee(hotelId, input.assigneeId);
    }

    const set: Record<string, unknown> = {};
    const changes: NonNullable<TaskUpdate['changes']> = {};
    const text = (field: 'title' | 'description', value: string | null | undefined) => {
      if (value === undefined || value === (task[field] ?? null)) return;
      set[field] = value;
      changes[field] = { from: task[field] ?? null, to: value };
    };
    text('title', input.title);
    text('description', input.description);
    if (input.department !== undefined && input.department !== task.department) {
      set.department = input.department;
      changes.department = {
        from: departmentLabel(task.department),
        to: departmentLabel(input.department),
      };
    }
    if (input.dueAt !== undefined && new Date(input.dueAt).getTime() !== task.dueAt.getTime()) {
      set.dueAt = new Date(input.dueAt);
      changes.dueAt = { from: task.dueAt.toISOString(), to: new Date(input.dueAt).toISOString() };
    }
    const roomChanged = input.roomId !== undefined && input.roomId !== key(task.roomId);
    const assigneeChanged =
      input.assigneeId !== undefined && input.assigneeId !== key(task.assigneeId);
    if (roomChanged || assigneeChanged) {
      const ids = [task.roomId, task.assigneeId].map(key);
      const [rooms, people] = await Promise.all([
        roomsById([task.roomId, input.roomId ? new Types.ObjectId(input.roomId) : null]),
        peopleById([
          task.assigneeId,
          input.assigneeId ? new Types.ObjectId(input.assigneeId) : null,
        ]),
      ]);
      if (roomChanged) {
        set.roomId = input.roomId;
        changes.room = {
          from: ids[0] ? (rooms.get(ids[0])?.roomNumber ?? null) : null,
          to: input.roomId ? (rooms.get(input.roomId)?.roomNumber ?? null) : null,
        };
      }
      if (assigneeChanged) {
        set.assigneeId = input.assigneeId;
        changes.assignee = {
          from: ids[1] ? (people.get(ids[1])?.name ?? null) : null,
          to: input.assigneeId ? (people.get(input.assigneeId)?.name ?? null) : null,
        };
      }
    }
    if (Object.keys(set).length === 0) return this.getById(hotelId, id);

    const updated = await TaskModel.findOneAndUpdate(
      { _id: id, hotelId, stage: { $in: OPEN_STAGES } },
      { $set: { ...set, updatedBy: actorId } },
      { new: true, runValidators: true },
    ).lean<LeanTask>();
    if (!updated) throw changedMeanwhile();
    await log(updated, 'edited', actorId, { changes });
    return this.getById(hotelId, id);
  },

  /**
   * One lifecycle step (Plan 04 §3). The task only moves if it is still in the stage we read,
   * so two people can't move it at once; then the step is added to the log.
   */
  async act(
    hotelId: string,
    id: string,
    input: TaskActionInput,
    actorId: string,
  ): Promise<TaskDetail> {
    const task = await findOrThrow(hotelId, id);
    const { action } = input;
    if (!ACTION_FROM[action].includes(task.stage)) {
      throw invalidStage(`This task is ${STAGE_LABEL[task.stage]}; that step isn't possible now`);
    }
    if (action === 'verify' && key(task.doneBy) === actorId) {
      throw new AppError(403, 'SELF_VERIFY', 'Someone else must verify work you marked done');
    }

    const now = new Date();
    let to: TaskStage;
    let set: Record<string, unknown> = {};
    switch (action) {
      case 'start':
        to = 'in_progress';
        break;
      case 'block':
        to = 'blocked';
        set = { blockedFrom: task.stage, blockedReason: input.note };
        break;
      case 'unblock':
        to = task.blockedFrom ?? 'pending';
        set = { blockedFrom: null, blockedReason: null };
        break;
      case 'done':
        to = 'done';
        set = { doneBy: actorId, doneAt: now };
        break;
      case 'verify':
        to = 'verified';
        set = { verifiedBy: actorId, verifiedAt: now };
        break;
      case 'send_back':
        to = 'in_progress';
        set = { doneBy: null, doneAt: null };
        break;
      case 'cancel':
        to = 'cancelled';
        set = { blockedFrom: null, blockedReason: null };
        break;
    }

    const updated = await TaskModel.findOneAndUpdate(
      { _id: id, hotelId, stage: task.stage },
      { $set: { ...set, stage: to, updatedBy: actorId } },
      { new: true },
    ).lean<LeanTask>();
    if (!updated) throw changedMeanwhile();

    await log(updated, ACTION_KIND[action], actorId, {
      fromStage: task.stage,
      toStage: to,
      note: input.note || null,
      photos: action === 'done' ? (input.photos ?? []).map((url) => ({ url })) : [],
    });
    return this.getById(hotelId, id);
  },
};
