import { type Task, type TaskStage, type TaskUpdate } from '@byke-os/shared';

import { Colors } from '@/constants/theme';

export const STAGE_LABEL: Record<TaskStage, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Waiting to verify',
  verified: 'Verified',
  cancelled: 'Cancelled',
};

/** Pill colours per stage. */
export const STAGE_LOOK: Record<TaskStage, { bg: string; fg: string; dot: string }> = {
  pending: { bg: '#EEF2F2', fg: '#4B5554', dot: '#8C9493' },
  in_progress: { bg: Colors.tile, fg: Colors.primaryPressed, dot: Colors.primary },
  blocked: { bg: '#FFF4E0', fg: '#9A5B00', dot: '#F0A020' },
  done: { bg: '#EAF0FF', fg: '#2F55B5', dot: '#4C7BF0' },
  verified: { bg: '#E7F6EC', fg: Colors.success, dot: '#2EA44F' },
  cancelled: { bg: Colors.errorBackground, fg: Colors.error, dot: '#E5484D' },
};

/** The four steps on the progress bar. */
export const PROGRESS_STEPS = ['Pending', 'In progress', 'Done', 'Verified'];

/** How far along the progress bar the task is (index of the last step reached). */
export function progressIndex(task: Pick<Task, 'stage' | 'blockedFrom'>): number {
  const stage = task.stage === 'blocked' ? (task.blockedFrom ?? 'pending') : task.stage;
  return { pending: 0, in_progress: 1, blocked: 0, done: 2, verified: 3, cancelled: 0 }[stage];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2:30 PM" */
export function clock(date: Date): string {
  const h = date.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(date.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Local calendar day key, "2026-11-21". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Mon 24 Nov". */
export function dayLabel(date: Date, now = new Date()): string {
  const diff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Today, 2:30 PM" */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${dayLabel(d)}, ${clock(d)}`;
}

function span(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 && h < 10 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day' : `${d} days`;
}

/** Due text for lists and the task screen, with whether it's late. */
export function dueText(task: Pick<Task, 'dueAt' | 'stage' | 'isOverdue'>, now = new Date()) {
  const due = new Date(task.dueAt);
  if (task.isOverdue) return { text: `${span(now.getTime() - due.getTime())} late`, late: true };
  if (task.stage === 'pending' || task.stage === 'in_progress' || task.stage === 'blocked') {
    const ms = due.getTime() - now.getTime();
    return {
      text: ms < 6 * 3_600_000 ? `Due in ${span(ms)}` : `Due ${dateTime(task.dueAt)}`,
      late: false,
    };
  }
  return { text: `Due ${dateTime(task.dueAt)}`, late: false };
}

/** "Ravi", "Ravi +2" or "Unassigned". */
export function assigneeText(task: Pick<Task, 'assignees'>): string {
  const [first, ...rest] = task.assignees;
  if (!first) return 'Unassigned';
  return rest.length ? `${first.name} +${rest.length}` : first.name;
}

/** "Room 101 · Housekeeping · Ravi" */
export function taskSubtitle(task: Task): string {
  return [
    task.room ? `Room ${task.room.roomNumber}` : null,
    task.department?.name,
    assigneeText(task),
  ]
    .filter(Boolean)
    .join(' · ');
}

const FIELD_LABEL: Record<string, string> = {
  title: 'title',
  description: 'description',
  department: 'department',
  dueAt: 'due time',
  room: 'room',
  assignees: 'assigned to',
};

/** One line per timeline entry: "Ravi marked it done". */
export function updateTitle(u: TaskUpdate): string {
  const who = u.by?.name ?? 'Someone';
  switch (u.kind) {
    case 'created':
      return `${who} created the task`;
    case 'started':
      return `${who} started`;
    case 'blocked':
      return `${who} marked it blocked`;
    case 'unblocked':
      return `${who} unblocked it`;
    case 'done':
      return `${who} marked it done`;
    case 'verified':
      return `${who} verified it`;
    case 'sent_back':
      return `${who} sent it back`;
    case 'cancelled':
      return `${who} cancelled it`;
    case 'edited':
      return `${who} changed the ${Object.keys(u.changes ?? {})
        .map((f) => FIELD_LABEL[f] ?? f)
        .join(', ')}`;
  }
}

/** For "edited" entries: "Due time: Today, 2:00 PM → Today, 4:00 PM". */
export function changeLines(u: TaskUpdate): string[] {
  return Object.entries(u.changes ?? {}).map(([field, { from, to }]) => {
    const show = (v: string | null) =>
      v === null || v === '' ? 'none' : field === 'dueAt' ? dateTime(v) : v;
    const label = FIELD_LABEL[field] ?? field;
    return `${label[0].toUpperCase()}${label.slice(1)}: ${show(from)} → ${show(to)}`;
  });
}

export function updateTone(u: TaskUpdate): 'primary' | 'success' | 'warning' | 'danger' | 'muted' {
  switch (u.kind) {
    case 'verified':
      return 'success';
    case 'done':
      return 'primary';
    case 'blocked':
    case 'sent_back':
      return 'warning';
    case 'cancelled':
      return 'danger';
    case 'started':
    case 'unblocked':
      return 'primary';
    default:
      return 'muted';
  }
}
