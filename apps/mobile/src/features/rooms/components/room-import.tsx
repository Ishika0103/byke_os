import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { RoomImportLog, RoomImportPreview, RoomImportResult } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Can } from '@/features/auth';
import { Screen } from '@/components/ui/screen';
import { LoaderOverlay } from '@/components/ui/loader';
import { SectionLabel } from '@/components/ui/section-label';
import { SelectField } from '@/components/ui/select-field';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useRoomTypeOptions } from '@/features/room-types';
import { errorMessage } from '@/lib/form-errors';
import { pickExcel, saveFile, type PickedExcel } from '@/lib/files';
import { roomsApi } from '../api/rooms.api';

const ANY = 'any';

const BUSY_TEXT: Record<string, { label: string; hint?: string }> = {
  sample: { label: 'Preparing the sample file…' },
  choose: { label: 'Reading and checking your file…', hint: 'Large files can take a few seconds.' },
  confirm: { label: 'Importing rooms…', hint: 'Please keep this screen open.' },
  export: { label: 'Preparing the export…' },
  rejected: { label: 'Preparing the rejected rows…' },
};

/** Plan 07: download the sample, upload the filled file, check the preview, confirm. */
export function RoomImport({ hotelId, header }: { hotelId: string; header: ReactNode }) {
  const types = useRoomTypeOptions(hotelId, true);
  const [roomTypeId, setRoomTypeId] = useState<string>(ANY);
  const [picked, setPicked] = useState<PickedExcel | null>(null);
  const [preview, setPreview] = useState<RoomImportPreview | null>(null);
  const [result, setResult] = useState<RoomImportResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RoomImportLog[]>([]);

  const loadHistory = useCallback(() => {
    roomsApi
      .importHistory(hotelId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [hotelId]);
  useEffect(loadHistory, [loadHistory]);

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const downloadSample = () =>
    run('sample', async () => {
      const { data, fileName } = await roomsApi.sampleFile(
        hotelId,
        roomTypeId === ANY ? undefined : roomTypeId,
      );
      await saveFile(fileName, data);
    });

  const choose = () =>
    run('choose', async () => {
      const file = await pickExcel();
      if (!file) return;
      setPicked(file);
      setResult(null);
      setPreview(null);
      setPreview(await roomsApi.previewImport(hotelId, file.toForm()));
    });

  const confirm = () =>
    run('confirm', async () => {
      if (!picked) return;
      setResult(await roomsApi.commitImport(hotelId, picked.toForm()));
      setPreview(null);
      loadHistory();
    });

  const exportRooms = () =>
    run('export', async () => {
      const { data, fileName } = await roomsApi.exportFile(hotelId);
      await saveFile(fileName, data);
    });

  const downloadRejected = () =>
    run('rejected', async () => {
      if (!picked) return;
      const { data, fileName } = await roomsApi.rejectedFile(hotelId, picked.toForm());
      await saveFile(fileName, data);
    });

  const rejected = preview?.rows.filter((r) => r.action === 'rejected') ?? [];
  const savable = preview ? preview.counts.create + preview.counts.update : 0;

  return (
    <Screen
      header={header}
      footer={
        preview ? (
          <Button
            title={
              savable ? `Import ${savable} room${savable === 1 ? '' : 's'}` : 'Nothing to import'
            }
            icon="check"
            onPress={confirm}
            loading={busy === 'confirm'}
            disabled={savable === 0 || !!busy}
          />
        ) : undefined
      }
    >
      <LoaderOverlay
        visible={!!busy}
        label={BUSY_TEXT[busy ?? '']?.label ?? 'Working…'}
        hint={BUSY_TEXT[busy ?? '']?.hint}
      />
      {error ? <Banner message={error} /> : null}

      <SectionLabel title="1. Download the sample" />
      <Card>
        <SelectField
          label="Room type (optional)"
          value={roomTypeId}
          options={[{ value: ANY, label: 'Any room type' }, ...types.options]}
          onChange={setRoomTypeId}
          placeholder="Any room type"
        />
        <ThemedText type="caption" themeColor="textSecondary">
          Pick one to get the file with that room type already filled in. Then you only type room
          numbers.
        </ThemedText>
        <Button
          title="Download sample file"
          icon="download"
          variant="soft"
          onPress={downloadSample}
          loading={busy === 'sample'}
          disabled={!!busy}
        />
      </Card>

      <SectionLabel title="2. Upload the filled file" />
      <Card>
        <Button
          title={picked ? 'Choose another file' : 'Choose Excel file'}
          icon="upload"
          variant="secondary"
          onPress={choose}
          loading={busy === 'choose'}
          disabled={!!busy}
        />
        {picked ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {picked.name}
          </ThemedText>
        ) : null}
      </Card>

      {preview ? (
        <>
          <SectionLabel title="3. Check, then import" />
          <View style={styles.tiles}>
            <Tile label="New" value={preview.counts.create} />
            <Tile label="Updated" value={preview.counts.update} />
            <Tile label="Unchanged" value={preview.counts.unchanged} />
            <Tile label="Rejected" value={preview.counts.rejected} bad />
          </View>
          {rejected.length > 0 ? (
            <Card>
              <ThemedText style={styles.listTitle}>Rows that will be skipped</ThemedText>
              {rejected.slice(0, 50).map((r) => (
                <ThemedText key={r.row} type="small" themeColor="textSecondary">
                  Row {r.row}: {r.errors.join('; ')}
                </ThemedText>
              ))}
              {rejected.length > 50 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  …and {rejected.length - 50} more (download them below)
                </ThemedText>
              ) : null}
              <Button
                title="Download rejected rows"
                icon="download"
                variant="soft"
                compact
                onPress={downloadRejected}
                loading={busy === 'rejected'}
                disabled={!!busy}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      <Can permission="view-room">
        <SectionLabel title="Export" />
        <Card>
          <ThemedText type="caption" themeColor="textSecondary">
            Download this hotel&apos;s rooms in the same layout. Edit it and upload it again to
            change many rooms at once.
          </ThemedText>
          <Button
            title="Export current rooms"
            icon="download"
            variant="soft"
            onPress={exportRooms}
            loading={busy === 'export'}
            disabled={!!busy}
          />
        </Card>
      </Can>

      {history.length > 0 ? (
        <>
          <SectionLabel title="Previous imports" />
          <Card>
            {history.map((h) => (
              <View key={h.fileUrl} style={styles.historyRow}>
                <View style={styles.historyText}>
                  <ThemedText style={styles.listTitle} numberOfLines={1}>
                    {h.fileName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(h.importedAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {h.importedBy ? ` · ${h.importedBy.name}` : ''} · {h.rooms} room
                    {h.rooms === 1 ? '' : 's'}
                  </ThemedText>
                </View>
                <Button
                  title="Open"
                  icon="download"
                  variant="soft"
                  compact
                  onPress={() => Linking.openURL(h.fileUrl)}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {result ? (
        <Card>
          <ThemedText style={styles.listTitle}>Import finished</ThemedText>
          <ThemedText>
            {result.created} created · {result.updated} updated · {result.unchanged} unchanged ·{' '}
            {result.rejected} skipped
          </ThemedText>
          {result.rejectedRows.slice(0, 50).map((r) => (
            <ThemedText key={r.row} type="small" themeColor="textSecondary">
              Row {r.row}: {r.errors.join('; ')}
            </ThemedText>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function Tile({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <View style={styles.tile}>
      <ThemedText style={[styles.tileValue, bad && value > 0 && { color: Colors.error }]}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: Spacing.two },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  historyText: { flex: 1, gap: 2 },
  tile: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  tileValue: { fontFamily: FontFamily.bold, fontSize: 22 },
  listTitle: { fontFamily: FontFamily.semiBold, fontSize: 15 },
});
