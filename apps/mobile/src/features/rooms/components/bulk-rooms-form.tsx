import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { bulkCreateRoomsSchema, MAX_BULK_ROOMS } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SelectField } from '@/components/ui/select-field';
import { SwitchField } from '@/components/ui/switch-field';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useRoomTypeOptions } from '@/features/room-types';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { notANumber, numberOrNull } from '@/lib/numbers';
import { roomsApi } from '../api/rooms.api';

/** Adds rooms From…To (e.g. 101–120) of one type in one go. */
export function BulkRoomsForm({
  hotelId,
  header,
  onSaved,
}: {
  hotelId: string;
  header: ReactNode;
  onSaved: (created: number) => void;
}) {
  const types = useRoomTypeOptions(hotelId);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [floorText, setFloorText] = useState('');
  const [isSellable, setIsSellable] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const from = numberOrNull(fromText);
  const to = numberOrNull(toText);
  const count =
    from !== null && to !== null && Number.isInteger(from) && Number.isInteger(to) && to >= from
      ? to - from + 1
      : 0;
  const tooMany = count > MAX_BULK_ROOMS;

  async function save() {
    setFormError(null);
    const floor = numberOrNull(floorText);
    const bad = notANumber({ from, to, floor });
    if (Object.keys(bad).length) return setErrors(bad);

    const parsed = bulkCreateRoomsSchema.safeParse({
      from: from ?? undefined,
      to: to ?? undefined,
      roomTypeId,
      floor,
      isSellable,
    });
    if (!parsed.success) {
      const fieldErrors = issuesToFieldErrors(parsed.error.issues);
      if (from === null) fieldErrors.from = 'Enter the first room number';
      if (to === null) fieldErrors.to = 'Enter the last room number';
      if (!roomTypeId) fieldErrors.roomTypeId = 'Choose a room type';
      return setErrors(fieldErrors);
    }
    setErrors({});
    setSaving(true);
    try {
      const { created } = await roomsApi.bulkCreate(hotelId, parsed.data);
      onSaved(created);
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
          title={
            count > 0 && !tooMany
              ? `Create ${count} ${count === 1 ? 'room' : 'rooms'}`
              : 'Create rooms'
          }
          icon="add"
          onPress={save}
          loading={saving}
        />
      }
    >
      {formError ? <Banner message={formError} /> : null}

      <SectionLabel title="Room numbers" />
      <Card>
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextField
              label="From"
              value={fromText}
              onChangeText={setFromText}
              error={errors.from}
              placeholder="101"
              keyboardType="number-pad"
              editable={!saving}
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="To"
              value={toText}
              onChangeText={setToText}
              error={errors.to}
              placeholder="120"
              keyboardType="number-pad"
              editable={!saving}
            />
          </View>
        </View>
        <ThemedText type="small" themeColor={tooMany ? 'error' : 'textSecondary'}>
          {tooMany
            ? `At most ${MAX_BULK_ROOMS} rooms at a time.`
            : count > 0
              ? `${count} ${count === 1 ? 'room' : 'rooms'} will be added: ${from}–${to}. If any of these numbers already exists, nothing is added.`
              : 'Every number from the first to the last becomes a room.'}
        </ThemedText>
      </Card>

      <SectionLabel title="Same for all of them" />
      <Card>
        <SelectField
          label="Room type"
          value={roomTypeId}
          options={types.options}
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
          searchable={types.options.length > 6}
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
        <SwitchField
          label="Sellable"
          description={
            isSellable
              ? 'Counted in inventory and sold to guests'
              : 'Staff, owner or store rooms; left out of inventory'
          }
          value={isSellable}
          onChange={setIsSellable}
          disabled={saving}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
});
