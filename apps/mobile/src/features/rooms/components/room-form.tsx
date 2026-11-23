import { usePermission } from '@/features/auth';
import { ReadOnly } from '@/components/ui/read-only';
import { useState, type ReactNode } from 'react';
import { createRoomSchema, updateRoomSchema, type Room } from '@byke-os/shared';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SelectField } from '@/components/ui/select-field';
import { StatusToggle } from '@/components/ui/status-toggle';
import { SwitchField } from '@/components/ui/switch-field';
import { TextField } from '@/components/ui/text-field';
import { useRoomTypeOptions } from '@/features/room-types';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { notANumber, numberOrNull } from '@/lib/numbers';
import { roomsApi } from '../api/rooms.api';

const CODE_FIELDS = { ROOM_NUMBER_TAKEN: 'roomNumber' };

/**
 * Add room (no `room`) or edit one. The edit screen passes its confirmed status toggle and
 * delete button as `children`.
 */
export function RoomForm({
  hotelId,
  room,
  header,
  onSaved,
  children,
}: {
  hotelId: string;
  room?: Room;
  header: ReactNode;
  onSaved: () => void;
  children?: ReactNode;
}) {
  const editing = !!room;
  // Without the edit permission an existing record is shown read-only (Plan 06).
  const canEdit = usePermission('edit-room');
  const locked = editing && !canEdit;
  const types = useRoomTypeOptions(hotelId);
  const [roomNumber, setRoomNumber] = useState(room?.roomNumber ?? '');
  const [roomTypeId, setRoomTypeId] = useState<string | null>(room?.roomType?.id ?? null);
  const [floorText, setFloorText] = useState(room?.floor?.toString() ?? '');
  const [isSellable, setIsSellable] = useState(room?.isSellable ?? true);
  const [notes, setNotes] = useState(room?.notes ?? '');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // An inactive type can't take new rooms, but a room already in one still shows it.
  const typeOptions =
    room?.roomType && !types.options.some((o) => o.value === room.roomType?.id)
      ? [
          ...types.options,
          { value: room.roomType.id, label: room.roomType.name, description: 'Inactive' },
        ]
      : types.options;

  async function save() {
    setFormError(null);
    const floor = numberOrNull(floorText);
    const bad = notANumber({ floor });
    if (Object.keys(bad).length) return setErrors(bad);
    const note = notes.trim() || null;

    try {
      if (room) {
        const changes = {
          ...(roomNumber.trim().toUpperCase() !== room.roomNumber && { roomNumber }),
          ...(roomTypeId !== room.roomType?.id && { roomTypeId: roomTypeId ?? undefined }),
          ...(floor !== room.floor && { floor }),
          ...(isSellable !== room.isSellable && { isSellable }),
          ...(note !== room.notes && { notes: note }),
        };
        if (Object.keys(changes).length === 0) return onSaved();
        const parsed = updateRoomSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await roomsApi.update(hotelId, room.id, parsed.data);
      } else {
        const parsed = createRoomSchema.safeParse({
          roomNumber,
          roomTypeId,
          floor,
          isSellable,
          notes: note,
          isActive,
        });
        if (!parsed.success) {
          const fieldErrors = issuesToFieldErrors(parsed.error.issues);
          if (!roomTypeId) fieldErrors.roomTypeId = 'Choose a room type';
          return setErrors(fieldErrors);
        }
        setErrors({});
        setSaving(true);
        await roomsApi.create(hotelId, parsed.data);
      }
      onSaved();
    } catch (e) {
      const { fields, message } = apiErrorToForm(e, CODE_FIELDS);
      setErrors(fields);
      setFormError(message);
      setSaving(false);
    }
  }

  return (
    <Screen
      header={header}
      footer={
        locked ? undefined : (
          <Button
            title={editing ? 'Save changes' : 'Create room'}
            icon={editing ? 'check' : 'add'}
            onPress={save}
            loading={saving}
          />
        )
      }
    >
      {formError ? <Banner message={formError} /> : null}
      <ReadOnly locked={locked}>
        <SectionLabel title="Details" />
        <Card>
          <TextField
            label="Room number"
            value={roomNumber}
            onChangeText={setRoomNumber}
            error={errors.roomNumber}
            placeholder="e.g. 101"
            autoCapitalize="characters"
            editable={!saving}
          />
          <SelectField
            label="Room type"
            value={roomTypeId}
            options={typeOptions}
            onChange={(v) => {
              setRoomTypeId(v);
              setErrors((e) => ({ ...e, roomTypeId: undefined }));
            }}
            placeholder={
              types.loading
                ? 'Loading…'
                : types.options.length
                  ? 'Choose a room type'
                  : 'Add a room type first'
            }
            error={errors.roomTypeId}
            disabled={saving || types.loading}
            searchable={typeOptions.length > 6}
          />
          <TextField
            label="Floor (optional)"
            value={floorText}
            onChangeText={setFloorText}
            error={errors.floor}
            placeholder="e.g. 1   (0 = ground)"
            keyboardType="numbers-and-punctuation"
            editable={!saving}
          />
        </Card>

        <SectionLabel title="Operations" />
        <Card>
          <SwitchField
            label="Sellable"
            description={
              isSellable
                ? 'Counted in inventory and sold to guests'
                : 'Staff, owner or store room; left out of inventory'
            }
            value={isSellable}
            onChange={setIsSellable}
            disabled={saving}
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            error={errors.notes}
            placeholder="e.g. Geyser weak, valley view"
            multiline
            editable={!saving}
          />
        </Card>

        {editing ? null : (
          <>
            <SectionLabel title="Status" />
            <StatusToggle
              active={isActive}
              onChange={setIsActive}
              description={isActive ? 'In use at the hotel' : 'Not in use for now'}
            />
          </>
        )}
      </ReadOnly>
      {children}
    </Screen>
  );
}
