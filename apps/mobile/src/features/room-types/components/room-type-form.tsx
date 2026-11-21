import { useState, type ReactNode } from 'react';
import { createRoomTypeSchema, updateRoomTypeSchema, type RoomType } from '@byke-os/shared';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { StatusToggle } from '@/components/ui/status-toggle';
import { TextField } from '@/components/ui/text-field';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { notANumber, numberOrNull } from '@/lib/numbers';
import { roomTypesApi } from '../api/room-types.api';

const CODE_FIELDS = { NAME_TAKEN: 'name' };

/**
 * Add room type (no `roomType`) or edit one. The code is made by the API from the name.
 * Status: a plain switch when adding; the edit screen passes its own confirmed toggle as `children`.
 */
export function RoomTypeForm({
  hotelId,
  roomType,
  header,
  onSaved,
  children,
}: {
  hotelId: string;
  roomType?: RoomType;
  header: ReactNode;
  onSaved: () => void;
  children?: ReactNode;
}) {
  const editing = !!roomType;
  const [name, setName] = useState(roomType?.name ?? '');
  const [pmsCode, setPmsCode] = useState(roomType?.pmsCode ?? '');
  const [minutes, setMinutes] = useState(roomType?.cleaningMinutes?.toString() ?? '');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setFormError(null);
    const cleaningMinutes = numberOrNull(minutes);
    const pms = pmsCode.trim() || null;
    const bad = notANumber({ cleaningMinutes });
    if (Object.keys(bad).length) return setErrors(bad);

    try {
      if (roomType) {
        const changes = {
          ...(name.trim() !== roomType.name && { name }),
          ...(pms?.toUpperCase() !== (roomType.pmsCode ?? undefined) && { pmsCode: pms }),
          ...(cleaningMinutes !== roomType.cleaningMinutes && { cleaningMinutes }),
        };
        if (Object.keys(changes).length === 0) return onSaved();
        const parsed = updateRoomTypeSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await roomTypesApi.update(hotelId, roomType.id, parsed.data);
      } else {
        const parsed = createRoomTypeSchema.safeParse({
          name,
          pmsCode: pms,
          cleaningMinutes,
          isActive,
        });
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await roomTypesApi.create(hotelId, parsed.data);
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
        <Button
          title={editing ? 'Save changes' : 'Create room type'}
          icon={editing ? 'check' : 'add'}
          onPress={save}
          loading={saving}
        />
      }
    >
      {formError ? <Banner message={formError} /> : null}

      <SectionLabel title="Details" />
      <Card>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="e.g. Deluxe Room"
          hint={editing ? undefined : 'A short code is made from the name, e.g. DLX.'}
          autoCapitalize="words"
          editable={!saving}
        />
        {roomType ? (
          <TextField
            label="Code"
            value={roomType.code}
            hint="Made from the name when it was created. It can't be changed."
            editable={false}
          />
        ) : null}
      </Card>

      <SectionLabel title="Operations" />
      <Card>
        <TextField
          label="PMS code (optional)"
          value={pmsCode}
          onChangeText={setPmsCode}
          error={errors.pmsCode}
          placeholder="e.g. DLXK"
          hint="The code for this room type in the PMS, to match its reports."
          autoCapitalize="characters"
          editable={!saving}
        />
        <TextField
          label="Cleaning time in minutes (optional)"
          value={minutes}
          onChangeText={setMinutes}
          error={errors.cleaningMinutes}
          placeholder="e.g. 30"
          hint="Standard time to clean one room, used for cleaning deadlines."
          keyboardType="number-pad"
          editable={!saving}
        />
      </Card>

      {editing ? null : (
        <>
          <SectionLabel title="Status" />
          <StatusToggle
            active={isActive}
            onChange={setIsActive}
            description={
              isActive ? 'Rooms can be added to it' : "Rooms can't be added to it for now"
            }
          />
        </>
      )}

      {children}
    </Screen>
  );
}
