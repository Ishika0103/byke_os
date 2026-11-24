import { useAuth, usePermission } from '@/features/auth';
import { ReadOnly } from '@/components/ui/read-only';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  createTaskSchema,
  updateTaskSchema,
  type Task,
  type TaskDetail,
  type TaskMaster,
} from '@byke-os/shared';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MultiSelectField } from '@/components/ui/multi-select-field';
import type { Option } from '@/components/ui/option-dialog';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { TIME_OPTIONS } from '@/features/hotels';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { tasksApi } from '../api/tasks.api';
import { useTaskChoices } from '../hooks/use-task-choices';
import { clock, dayKey, dayLabel } from '../utils/format';

const NONE = 'none';
const OTHER = 'other';

/** Default due time: an hour from now, rounded up to the next half hour. */
function defaultDue(): Date {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  if (m !== 0 && m !== 30) d.setMinutes(m < 30 ? 30 : 60);
  return d;
}

const timeKey = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Today and the next 6 days (+ the task's current day if it's outside that). */
function dayOptions(current: Date): Option[] {
  const today = new Date();
  const days = Array.from(
    { length: 7 },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
  );
  if (!days.some((d) => dayKey(d) === dayKey(current))) days.unshift(current);
  return days.map((d) => ({ value: dayKey(d), label: dayLabel(d) }));
}

/**
 * Add task (no `task`) or edit an open task.
 * Add: Title (a predefined one or Other) -> Department -> Rooms (one task per room) -> Details ->
 * Who and when. Edit changes one task (a single room).
 */
export function TaskForm({
  hotelId,
  task,
  header,
  onSaved,
}: {
  hotelId: string;
  task?: TaskDetail;
  header: ReactNode;
  /** The tasks that were saved: several when rooms were chosen on a new task. */
  onSaved: (tasks: Task[]) => void;
}) {
  const editing = !!task;
  // Without the edit permission an existing record is shown read-only (Plan 06).
  const canEdit = usePermission('edit-task');
  const locked = editing && !canEdit;
  const initialDue = useMemo(() => (task ? new Date(task.dueAt) : defaultDue()), [task]);
  const choices = useTaskChoices(hotelId);
  const { user } = useAuth();

  const [masterId, setMasterId] = useState<string | null>(null);
  const [title, setTitle] = useState(task?.title ?? '');
  const [departmentId, setDepartmentId] = useState<string | null>(task?.department?.id ?? null);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [roomId, setRoomId] = useState(task?.room?.id ?? NONE);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees.map((a) => a.id) ?? []);
  // New tasks default the verifier to the creator; they can pick someone else.
  const [verifierId, setVerifierId] = useState<string | null>(
    task ? (task.verifier?.id ?? null) : (user?.id ?? null),
  );
  const [day, setDay] = useState(dayKey(initialDue));
  const [time, setTime] = useState(timeKey(initialDue));
  const [description, setDescription] = useState(task?.description ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => dayOptions(initialDue), [initialDue]);
  const times = useMemo(
    () =>
      TIME_OPTIONS.some((o) => o.value === timeKey(initialDue))
        ? TIME_OPTIONS
        : [...TIME_OPTIONS, { value: timeKey(initialDue), label: clock(initialDue) }].sort((a, b) =>
            a.value.localeCompare(b.value),
          ),
    [initialDue],
  );

  const titleOptions: Option[] = [
    ...choices.masters.map((m) => ({ value: m.id, label: m.title })),
    { value: OTHER, label: 'Other' },
  ];
  // Keep the current department / room / people choosable even if they're now inactive.
  const departmentOptions = withCurrent(
    choices.departments,
    task?.department ? { value: task.department.id, label: task.department.name } : null,
  );
  const roomOptions = withCurrent(
    [{ value: NONE, label: 'No room' }, ...choices.rooms],
    task?.room ? { value: task.room.id, label: `Room ${task.room.roomNumber}` } : null,
  );
  const peopleOptions = (task?.assignees ?? []).reduce(
    (list, a) => withCurrent(list, { value: a.id, label: a.name }),
    choices.people,
  );

  // The verifier can't be one of the assignees (they'd verify their own work).
  const verifierOptions = (
    task?.verifier
      ? withCurrent(choices.people, { value: task.verifier.id, label: task.verifier.name })
      : choices.people
  ).filter((p) => !assigneeIds.includes(p.value));

  function pickAssignees(ids: string[]) {
    setAssigneeIds(ids);
    if (verifierId && ids.includes(verifierId)) setVerifierId(null);
  }

  function pickTitle(value: string) {
    setMasterId(value);
    setErrors((e) => ({ ...e, title: undefined }));
    const master: TaskMaster | undefined = choices.masters.find((m) => m.id === value);
    if (master) {
      setTitle(master.title);
      // Pre-fill the department from the master; it can still be changed.
      if (master.department) setDepartmentId(master.department.id);
    } else {
      setTitle('');
    }
  }

  async function save() {
    setFormError(null);
    const dueAt = new Date(`${day}T${time}:00`).toISOString();
    const desc = description.trim() || null;
    try {
      let saved: Task[];
      if (task) {
        const sameAssignees =
          assigneeIds.length === task.assignees.length &&
          assigneeIds.every((id) => task.assignees.some((a) => a.id === id));
        const newRoom = roomId === NONE ? null : roomId;
        const changes = {
          ...(title.trim() !== task.title && { title }),
          ...(departmentId !== task.department?.id && { departmentId: departmentId ?? undefined }),
          ...(newRoom !== (task.room?.id ?? null) && { roomId: newRoom }),
          ...(!sameAssignees && { assigneeIds }),
          ...(verifierId && verifierId !== task.verifier?.id && { verifierId }),
          ...(new Date(dueAt).getTime() !== new Date(task.dueAt).getTime() && { dueAt }),
          ...(desc !== task.description && { description: desc }),
        };
        if (Object.keys(changes).length === 0) return onSaved([task]);
        const parsed = updateTaskSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        saved = [await tasksApi.update(hotelId, task.id, parsed.data)];
      } else {
        if (!masterId) return setErrors({ title: 'Choose a title' });
        const isMaster = masterId !== OTHER;
        const parsed = createTaskSchema.safeParse({
          title,
          taskMasterId: isMaster ? masterId : null,
          departmentId: departmentId ?? undefined,
          roomIds,
          assigneeIds,
          verifierId: verifierId ?? undefined,
          description: desc,
          dueAt,
        });
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        saved = (await tasksApi.create(hotelId, parsed.data)).tasks;
      }
      onSaved(saved);
    } catch (e) {
      const { fields, message } = apiErrorToForm(e);
      setErrors(fields);
      setFormError(message);
      setSaving(false);
    }
  }

  const createLabel = roomIds.length > 1 ? `Create ${roomIds.length} tasks` : 'Create task';

  return (
    <Screen
      header={header}
      footer={
        locked ? undefined : (
          <Button
            title={editing ? 'Save changes' : createLabel}
            icon={editing ? 'check' : 'add'}
            onPress={save}
            loading={saving}
          />
        )
      }
    >
      {formError ? <Banner message={formError} /> : null}
      <ReadOnly locked={locked}>
        <SectionLabel title="What" />
        <Card>
          {editing ? (
            <TextField
              label="Title"
              value={title}
              onChangeText={setTitle}
              error={errors.title}
              autoCapitalize="sentences"
              editable={!saving}
            />
          ) : (
            <>
              <SelectField
                label="Title"
                value={masterId}
                options={titleOptions}
                onChange={pickTitle}
                placeholder="Choose what needs doing"
                error={masterId === OTHER ? undefined : errors.title}
                disabled={saving}
              />
              {masterId === OTHER ? (
                <TextField
                  label="Your title"
                  value={title}
                  onChangeText={setTitle}
                  error={errors.title}
                  placeholder="e.g. Fix AC in 204"
                  autoCapitalize="sentences"
                  editable={!saving}
                />
              ) : null}
            </>
          )}
          <SelectField
            label="Department"
            value={departmentId}
            options={departmentOptions}
            onChange={(v) => {
              setDepartmentId(v);
              setErrors((e) => ({ ...e, departmentId: undefined }));
            }}
            placeholder="Choose a department"
            error={errors.departmentId}
            disabled={saving}
          />
          {editing ? (
            <SelectField
              label="Room (optional)"
              value={roomId}
              options={roomOptions}
              onChange={setRoomId}
              error={errors.roomId}
              disabled={saving}
              searchable={roomOptions.length > 8}
              searchPlaceholder="Search room"
            />
          ) : (
            <MultiSelectField
              label="Rooms (optional)"
              values={roomIds}
              options={choices.rooms}
              onChange={setRoomIds}
              placeholder="No room"
              hint={roomIds.length > 1 ? 'One task is created for each room.' : undefined}
              error={errors.roomIds}
              disabled={saving}
              searchPlaceholder="Search room"
            />
          )}
          <TextField
            label="Details (optional)"
            value={description}
            onChangeText={setDescription}
            error={errors.description}
            placeholder="Anything the person doing it should know"
            multiline
            editable={!saving}
          />
        </Card>

        <SectionLabel title="Who and when" />
        <Card>
          <MultiSelectField
            label="Assigned to (optional)"
            values={assigneeIds}
            options={peopleOptions}
            onChange={pickAssignees}
            placeholder="Unassigned"
            error={errors.assigneeIds}
            disabled={saving}
            searchPlaceholder="Search name or email"
          />
          <SelectField
            label="Verifier"
            value={verifierId}
            options={verifierOptions}
            onChange={(v) => {
              setVerifierId(v);
              setErrors((e) => ({ ...e, verifierId: undefined }));
            }}
            placeholder="Who checks the work?"
            error={errors.verifierId}
            disabled={saving}
            searchable={verifierOptions.length > 8}
            searchPlaceholder="Search name or email"
          />
          <View style={styles.pair}>
            <View style={styles.half}>
              <SelectField
                label="Due day"
                value={day}
                options={days}
                onChange={setDay}
                error={errors.dueAt}
                disabled={saving}
              />
            </View>
            <View style={styles.half}>
              <SelectField
                label="Due time"
                value={time}
                options={times}
                onChange={setTime}
                disabled={saving}
              />
            </View>
          </View>
        </Card>
      </ReadOnly>
    </Screen>
  );
}

function withCurrent(options: Option[], current: Option | null): Option[] {
  if (!current || options.some((o) => o.value === current.value)) return options;
  return [...options, current];
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
});
