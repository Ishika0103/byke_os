import { Types } from 'mongoose';
import {
  ACTION_FROM,
  CLOSED_STAGES,
  OPEN_STAGES,
  TASK_STAGES,
  type CreateTaskInput,
  type CreatedTasks,
  type DepartmentSummary,
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
import type { NotificationKind } from '@byke-os/shared';
import { type LeanBase, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { escapeRegex } from '../../utils/query';
import { DepartmentModel } from '../departments/department.model';
import { TaskMasterModel } from '../task-masters/task-master.model';
import { RoomModel } from '../rooms/room.model';
import { notificationService } from '../notifications/notification.service';
import { uploadService } from '../uploads/upload.service';
import { UserModel } from '../users/user.model';
import { isSuperAdminRole } from '../users/user.service';
import { TaskModel, TaskUpdateModel } from './task.model';

type Id = Types.ObjectId;

type LeanTask = LeanBase & {
  hotelId: Id;
  title: string;
  description: string | null;
  taskMasterId: Id | null;
  groupId: Id;
  departmentId: Id;
  roomId: Id | null;
  assigneeIds: Id[];
  dueAt: Date;
  stage: TaskStage;
  verifierId: Id | null;
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
  done: 'done',
  verified: 'verified',
  cancelled: 'cancelled',
};

const ACTION_KIND: Record<TaskAction, TaskUpdateKind> = {
  start: 'started',
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
const key = (id: Id | null | undefined) => (id ? String(id) : null);

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

async function departmentsById(ids: Id[]): Promise<Map<string, DepartmentSummary>> {
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return new Map();
  const departments = await DepartmentModel.find({
    _id: { $in: unique },
    isDeleted: { $in: [true, false] },
  })
    .select('name code')
    .lean<{ _id: Id; name: string; code: string }[]>();
  return new Map(
    departments.map((d) => [String(d._id), { id: String(d._id), name: d.name, code: d.code }]),
  );
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

async function toDtos(tasks: LeanTask[], actorId: string): Promise<Task[]> {
  const [people, rooms, departments] = await Promise.all([
    peopleById(
      tasks.flatMap((t) => [...(t.assigneeIds ?? []), t.doneBy, t.verifiedBy, t.verifierId]),
    ),
    roomsById(tasks.map((t) => t.roomId)),
    departmentsById(tasks.map((t) => t.departmentId)),
  ]);
  const person = (id: Id | null) => (id ? (people.get(String(id)) ?? null) : null);
  const now = new Date();
  return tasks.map((t) => ({
    ...toBaseDto(t),
    hotelId: String(t.hotelId),
    title: t.title,
    description: t.description ?? null,
    taskMasterId: key(t.taskMasterId ?? null),
    groupId: String(t.groupId),
    department: departments.get(String(t.departmentId)) ?? null,
    room: t.roomId ? (rooms.get(String(t.roomId)) ?? null) : null,
    assignees: (t.assigneeIds ?? []).flatMap((id) => person(id) ?? []),
    dueAt: t.dueAt.toISOString(),
    stage: t.stage,
    verifier: person(t.verifierId ?? null) ?? { id: '', name: 'Not set' },
    canVerify: t.stage === 'done' && key(t.verifierId) === actorId && key(t.doneBy) !== actorId,
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

async function assertRooms(hotelId: string, roomIds: string[], field = 'roomIds') {
  if (roomIds.length === 0) return;
  const found = await RoomModel.countDocuments({ _id: { $in: roomIds }, hotelId });
  if (found !== roomIds.length) throw AppError.field(field, 'Room not found in this hotel');
}

async function assertDepartment(departmentId: string) {
  if (!(await DepartmentModel.exists({ _id: departmentId, isActive: true }))) {
    throw AppError.field('departmentId', 'Department not found or inactive');
  }
}

/** Every assignee must be active and work at this hotel (Plan 05; Super Admin works everywhere). */
async function assertAssignees(hotelId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const users = await UserModel.find({ _id: { $in: userIds }, isActive: true })
    .select('roleId hotelIds')
    .lean<{ _id: Id; roleId: Id; hotelIds?: Id[] }[]>();
  if (users.length !== userIds.length) {
    throw AppError.field('assigneeIds', 'A selected user was not found or is inactive');
  }
  for (const user of users) {
    const atHotel = (user.hotelIds ?? []).some((h) => String(h) === hotelId);
    if (!atHotel && !(await isSuperAdminRole(String(user.roleId)))) {
      throw AppError.field('assigneeIds', 'A selected person is not added to this hotel');
    }
  }
}

/** The verifier must be active, work at this hotel, and not be one of the assignees (Plan 12). */
async function assertVerifier(hotelId: string, verifierId: string, assigneeIds: string[]) {
  if (assigneeIds.includes(verifierId)) {
    throw AppError.field('verifierId', 'The verifier can not be one of the assignees');
  }
  const user = await UserModel.findOne({ _id: verifierId, isActive: true })
    .select('roleId hotelIds')
    .lean<{ _id: Id; roleId: Id; hotelIds?: Id[] }>();
  if (!user) throw AppError.field('verifierId', 'The verifier was not found or is inactive');
  const atHotel = (user.hotelIds ?? []).some((h) => String(h) === hotelId);
  if (!atHotel && !(await isSuperAdminRole(String(user.roleId)))) {
    throw AppError.field('verifierId', 'The verifier is not added to this hotel');
  }
}

const unique = (ids: string[] | null | undefined) => [...new Set(ids ?? [])];
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

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
    const { page, limit, q, view, departmentId, assigneeId, roomId, overdue } = query;
    let stages = VIEW_STAGES[view];
    const filter: Record<string, unknown> = { hotelId };
    if (overdue) {
      stages = stages.filter(isOpen);
      filter.dueAt = { $lt: new Date() };
    }
    filter.stage = { $in: stages };
    if (departmentId) filter.departmentId = departmentId;
    // Matches any of the task's assignees.
    if (assigneeId) filter.assigneeIds = assigneeId === 'me' ? actorId : assigneeId;
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
    return { items: await toDtos(items, actorId), page, limit, total };
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

  async getById(hotelId: string, id: string, actorId: string): Promise<TaskDetail> {
    const task = await findOrThrow(hotelId, id);
    const updates = await TaskUpdateModel.find({ taskId: task._id })
      .sort({ createdAt: 1, _id: 1 })
      .lean<LeanUpdate[]>();
    const [[dto], people] = await Promise.all([
      toDtos([task], actorId),
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

  /**
   * One task per room (or one task without a room when none is chosen), all in one group with
   * the same title, department, details, people and due time (Plan 09 §7a).
   */
  async create(hotelId: string, input: CreateTaskInput, actorId: string): Promise<CreatedTasks> {
    const roomIds = unique(input.roomIds);
    const assigneeIds = unique(input.assigneeIds);
    await Promise.all([
      assertDepartment(input.departmentId),
      assertRooms(hotelId, roomIds),
      assertAssignees(hotelId, assigneeIds),
      assertVerifier(hotelId, input.verifierId, assigneeIds),
    ]);
    let title = input.title;
    if (input.taskMasterId) {
      const master = await TaskMasterModel.findOne({ _id: input.taskMasterId, isActive: true })
        .select('title')
        .lean<{ title: string }>();
      if (!master) throw AppError.field('taskMasterId', 'Task title not found');
      title = master.title;
    }

    const groupId = new Types.ObjectId();
    const tasks = await TaskModel.create(
      (roomIds.length ? roomIds : [null]).map((roomId) => ({
        hotelId,
        title,
        description: input.description ?? null,
        taskMasterId: input.taskMasterId ?? null,
        groupId,
        departmentId: input.departmentId,
        roomId,
        assigneeIds,
        verifierId: input.verifierId,
        dueAt: new Date(input.dueAt),
        stage: 'pending',
        createdBy: actorId,
        updatedBy: actorId,
      })),
    );
    for (const task of tasks) await log(task, 'created', actorId, { toStage: 'pending' });

    for (const t of tasks) {
      await notificationService.notify({
        userIds: unique(input.assigneeIds ?? []),
        hotelId,
        taskId: String(t._id),
        kind: 'task_assigned',
        title: `New task: ${t.title}`,
        exceptUserId: actorId,
      });
    }
    const created = await TaskModel.find({ groupId, hotelId }).sort({ _id: 1 }).lean<LeanTask[]>();
    return { groupId: String(groupId), tasks: await toDtos(created, actorId) };
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
    const roomChanged = input.roomId !== undefined && input.roomId !== key(task.roomId);
    const oldAssignees = (task.assigneeIds ?? []).map(String);
    const newAssignees = input.assigneeIds === undefined ? null : unique(input.assigneeIds);
    const assigneesChanged = newAssignees !== null && !sameSet(newAssignees, oldAssignees);
    const departmentChanged =
      input.departmentId !== undefined && input.departmentId !== String(task.departmentId);
    if (roomChanged) await assertRooms(hotelId, input.roomId ? [input.roomId] : [], 'roomId');
    if (assigneesChanged) await assertAssignees(hotelId, newAssignees);
    const oldVerifier = key(task.verifierId);
    const verifierChanged = input.verifierId !== undefined && input.verifierId !== oldVerifier;
    // Check the verifier whenever either side changes, so they never end up assigned to their own task.
    if (verifierChanged || (assigneesChanged && oldVerifier)) {
      await assertVerifier(hotelId, input.verifierId ?? oldVerifier!, newAssignees ?? oldAssignees);
    }
    if (departmentChanged) await assertDepartment(input.departmentId!);

    const set: Record<string, unknown> = {};
    const changes: NonNullable<TaskUpdate['changes']> = {};
    const text = (field: 'title' | 'description', value: string | null | undefined) => {
      if (value === undefined || value === (task[field] ?? null)) return;
      set[field] = value;
      changes[field] = { from: task[field] ?? null, to: value };
    };
    text('title', input.title);
    text('description', input.description);
    if (departmentChanged) {
      const departments = await departmentsById([
        task.departmentId,
        new Types.ObjectId(input.departmentId),
      ]);
      set.departmentId = input.departmentId;
      changes.department = {
        from: departments.get(String(task.departmentId))?.name ?? null,
        to: departments.get(input.departmentId!)?.name ?? null,
      };
    }
    if (input.dueAt !== undefined && new Date(input.dueAt).getTime() !== task.dueAt.getTime()) {
      set.dueAt = new Date(input.dueAt);
      changes.dueAt = { from: task.dueAt.toISOString(), to: new Date(input.dueAt).toISOString() };
    }
    if (roomChanged) {
      const rooms = await roomsById([
        task.roomId,
        input.roomId ? new Types.ObjectId(input.roomId) : null,
      ]);
      set.roomId = input.roomId;
      changes.room = {
        from: task.roomId ? (rooms.get(String(task.roomId))?.roomNumber ?? null) : null,
        to: input.roomId ? (rooms.get(input.roomId)?.roomNumber ?? null) : null,
      };
    }
    if (assigneesChanged) {
      const people = await peopleById(
        [...oldAssignees, ...newAssignees].map((i) => new Types.ObjectId(i)),
      );
      const names = (ids: string[]) =>
        ids.length ? ids.map((i) => people.get(i)?.name ?? 'Unknown').join(', ') : null;
      set.assigneeIds = newAssignees;
      changes.assignees = { from: names(oldAssignees), to: names(newAssignees) };
    }
    if (verifierChanged) {
      const people = await peopleById([task.verifierId, new Types.ObjectId(input.verifierId)]);
      set.verifierId = input.verifierId;
      changes.verifier = {
        from: oldVerifier ? (people.get(oldVerifier)?.name ?? null) : null,
        to: people.get(input.verifierId!)?.name ?? null,
      };
    }
    if (Object.keys(set).length === 0) return this.getById(hotelId, id, actorId);

    const updated = await TaskModel.findOneAndUpdate(
      { _id: id, hotelId, stage: { $in: OPEN_STAGES } },
      { $set: { ...set, updatedBy: actorId } },
      { new: true, runValidators: true },
    ).lean<LeanTask>();
    if (!updated) throw changedMeanwhile();
    await log(updated, 'edited', actorId, { changes });
    if (newAssignees) {
      await notificationService.notify({
        userIds: newAssignees.filter((u) => !oldAssignees.includes(u)),
        hotelId,
        taskId: id,
        kind: 'task_assigned',
        title: `Task assigned to you: ${updated.title}`,
        exceptUserId: actorId,
      });
    }
    if (verifierChanged) {
      await notificationService.notify({
        userIds: [input.verifierId!],
        hotelId,
        taskId: id,
        kind: 'task_needs_verification',
        title: `You are the verifier: ${updated.title}`,
        exceptUserId: actorId,
      });
    }
    return this.getById(hotelId, id, actorId);
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
    if (
      (action === 'done' || action === 'verify') &&
      input.photos?.some((url) => !uploadService.isOwnPhoto(url))
    ) {
      throw AppError.field('photos', 'Upload the photo from the app first');
    }
    if ((action === 'verify' || action === 'send_back') && key(task.verifierId) !== actorId) {
      throw new AppError(403, 'NOT_VERIFIER', 'Only the task verifier can do this');
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
        break;
    }

    const updated = await TaskModel.findOneAndUpdate(
      { _id: id, hotelId, stage: task.stage },
      { $set: { ...set, stage: to, updatedBy: actorId } },
      { new: true },
    ).lean<LeanTask>();
    if (!updated) throw changedMeanwhile();

    await notifyAction(action, task, updated, actorId, hotelId);
    await log(updated, ACTION_KIND[action], actorId, {
      fromStage: task.stage,
      toStage: to,
      note: input.note || null,
      photos:
        action === 'done' || action === 'verify'
          ? (input.photos ?? []).map((url) => ({ url }))
          : [],
    });
    return this.getById(hotelId, id, actorId);
  },
};

const ACTION_NOTIFY: Partial<Record<TaskActionInput['action'], [NotificationKind, string]>> = {
  start: ['task_started', 'Task started'],
  done: ['task_done', 'Task done'],
  send_back: ['task_sent_back', 'Task sent back'],
  verify: ['task_verified', 'Task verified'],
};

/** Tells the creator and the assignees (not the person who acted) what happened. */
async function notifyAction(
  action: TaskActionInput['action'],
  before: LeanTask,
  after: LeanTask,
  actorId: string,
  hotelId: string,
) {
  const entry = ACTION_NOTIFY[action];
  if (!entry) return;
  const [kind, label] = entry;
  const everyone = unique(
    [...(after.assigneeIds ?? []).map(String), key(after.createdBy) ?? ''].filter(Boolean),
  );
  const taskId = String(after._id);
  await notificationService.notify({
    userIds: everyone,
    hotelId,
    taskId,
    kind,
    title: `${label}: ${after.title}`,
    exceptUserId: actorId,
  });
  // Done work needs the verifier's check.
  if (action === 'done' && before.verifierId) {
    await notificationService.notify({
      userIds: [String(before.verifierId)],
      hotelId,
      taskId,
      kind: 'task_needs_verification',
      title: `Needs your verification: ${after.title}`,
      exceptUserId: actorId,
    });
  }
}
