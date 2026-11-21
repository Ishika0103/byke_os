import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  DEPARTMENTS,
  createTaskSchema,
  updateTaskSchema,
  type DepartmentKey,
  type TaskDetail,
} from '@byke-os/shared';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Option } from '@/components/ui/option-dialog';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { TIME_OPTIONS } from '@/features/hotels';
import { roomsApi } from '@/features/rooms';
import { usersApi } from '@/features/users';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { tasksApi } from '../api/tasks.api';
import { clock, dayKey, dayLabel } from '../utils/format';

const NONE = 'none';
const DEPARTMENT_OPTIONS: Option[] = DEPARTMENTS.map((d) => ({ value: d.key, label: d.label }));

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

/** Room and assignee choices for the drawers ("No room" / "Unassigned" first). */
function useChoices(hotelId: string) {
  const [rooms, setRooms] = useState<Option[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  useEffect(() => {
    let cancelled = false;
    roomsApi
      .list(hotelId, { limit: 300, isActive: true })
      .then((p) => {
        if (cancelled) return;
        setRooms(
          p.items.map((r) => ({
            value: r.id,
            label: `Room ${r.roomNumber}`,
            description: r.roomType?.name,
          })),
        );
      })
      .catch(() => {});
    usersApi
      .list({ limit: 100, isActive: true })
      .then((p) => {
        if (cancelled) return;
        setPeople(p.items.map((u) => ({ value: u.id, label: u.name, description: u.email })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hotelId]);
  return { rooms, people };
}

/**
 * Add task (no `task`) or edit an open task. Only the title, department and due time are required.
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
  onSaved: (task: TaskDetail) => void;
}) {
  const editing = !!task;
  const initialDue = useMemo(() => (task ? new Date(task.dueAt) : defaultDue()), [task]);
  const choices = useChoices(hotelId);

  const [title, setTitle] = useState(task?.title ?? '');
  const [department, setDepartment] = useState<DepartmentKey | null>(task?.department ?? null);
  const [roomId, setRoomId] = useState(task?.room?.id ?? NONE);
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ?? NONE);
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
  // Keep the current room / person choosable even if they're now inactive.
  const roomOptions = withCurrent(
    [{ value: NONE, label: 'No room' }, ...choices.rooms],
    task?.room ? { value: task.room.id, label: `Room ${task.room.roomNumber}` } : null,
  );
  const peopleOptions = withCurrent(
    [{ value: NONE, label: 'Unassigned' }, ...choices.people],
    task?.assignee ? { value: task.assignee.id, label: task.assignee.name } : null,
  );

  async function save() {
    setFormError(null);
    const values = {
      title,
      department: department ?? undefined,
      roomId: roomId === NONE ? null : roomId,
      assigneeId: assigneeId === NONE ? null : assigneeId,
      dueAt: new Date(`${day}T${time}:00`).toISOString(),
      description: description.trim() || null,
    };
    try {
      let saved: TaskDetail;
      if (task) {
        const changes = {
          ...(title.trim() !== task.title && { title }),
          ...(department !== task.department && { department: values.department }),
          ...(values.roomId !== (task.room?.id ?? null) && { roomId: values.roomId }),
          ...(values.assigneeId !== (task.assignee?.id ?? null) && {
            assigneeId: values.assigneeId,
          }),
          ...(new Date(values.dueAt).getTime() !== new Date(task.dueAt).getTime() && {
            dueAt: values.dueAt,
          }),
          ...(values.description !== task.description && { description: values.description }),
        };
        if (Object.keys(changes).length === 0) return onSaved(task);
        const parsed = updateTaskSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        saved = await tasksApi.update(hotelId, task.id, parsed.data);
      } else {
        const parsed = createTaskSchema.safeParse(values);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        saved = await tasksApi.create(hotelId, parsed.data);
      }
      onSaved(saved);
    } catch (e) {
      const { fields, message } = apiErrorToForm(e);
      setErrors(fields);
      setFormError(message);
      setSaving(false);
    }
  }

  return (
    <Screen
      header={header}
      footer={
        <Button
          title={editing ? 'Save changes' : 'Create task'}
          icon={editing ? 'check' : 'add'}
          onPress={save}
          loading={saving}
        />
      }
    >
      {formError ? <Banner message={formError} /> : null}

      <SectionLabel title="What" />
      <Card>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          placeholder="e.g. Clean room 101, Fix AC in 204"
          autoCapitalize="sentences"
          editable={!saving}
        />
        <SelectField
          label="Department"
          value={department}
          options={DEPARTMENT_OPTIONS}
          onChange={(v) => {
            setDepartment(v as DepartmentKey);
            setErrors((e) => ({ ...e, department: undefined }));
          }}
          placeholder="Choose a department"
          error={errors.department}
          disabled={saving}
        />
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
        <SelectField
          label="Assigned to (optional)"
          value={assigneeId}
          options={peopleOptions}
          onChange={setAssigneeId}
          error={errors.assigneeId}
          disabled={saving}
          searchable={peopleOptions.length > 8}
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
