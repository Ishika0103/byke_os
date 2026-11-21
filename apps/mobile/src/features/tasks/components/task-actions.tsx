import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { MAX_TASK_PHOTOS, type TaskAction, type TaskDetail } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { apiFileUrl } from '@/lib/api-client';
import { errorMessage } from '@/lib/form-errors';
import { tasksApi } from '../api/tasks.api';

type Props = { hotelId: string; task: TaskDetail; onChanged: (task: TaskDetail) => void };

const REASON_COPY: Record<
  'block' | 'send_back' | 'cancel',
  { title: string; hint: string; button: string }
> = {
  block: {
    title: 'Why is it blocked?',
    hint: 'e.g. Waiting for the plumber, guest in room',
    button: 'Mark blocked',
  },
  send_back: {
    title: 'What still needs doing?',
    hint: 'e.g. Towels missing, bathroom not cleaned',
    button: 'Send back',
  },
  cancel: {
    title: 'Why cancel this task?',
    hint: 'e.g. Guest checked out early, raised twice',
    button: 'Cancel task',
  },
};

/** The buttons allowed for the task's stage, and the sheets they open (proof, reason, verify). */
export function TaskActions({ hotelId, task, onChanged }: Props) {
  const [busy, setBusy] = useState<TaskAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'done' | 'block' | 'send_back' | 'cancel' | 'verify' | null>(
    null,
  );

  async function run(action: TaskAction, extra: { note?: string; photos?: string[] } = {}) {
    setBusy(action);
    setError(null);
    try {
      onChanged(await tasksApi.act(hotelId, task.id, { action, ...extra }));
      setSheet(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const open = (s: typeof sheet) => {
    setError(null);
    setSheet(s);
  };

  let buttons: React.ReactNode = null;
  switch (task.stage) {
    case 'pending':
      buttons = (
        <>
          <Button
            title="Start"
            icon="play"
            onPress={() => run('start')}
            loading={busy === 'start'}
          />
          <Row>
            <Button title="Blocked" icon="block" variant="soft" onPress={() => open('block')} />
            <Button title="Cancel" icon="close" variant="danger" onPress={() => open('cancel')} />
          </Row>
        </>
      );
      break;
    case 'in_progress':
      buttons = (
        <>
          <Button title="Mark done" icon="check" onPress={() => open('done')} />
          <Row>
            <Button title="Blocked" icon="block" variant="soft" onPress={() => open('block')} />
            <Button title="Cancel" icon="close" variant="danger" onPress={() => open('cancel')} />
          </Row>
        </>
      );
      break;
    case 'blocked':
      buttons = (
        <>
          <Button
            title="Unblock"
            icon="play"
            onPress={() => run('unblock')}
            loading={busy === 'unblock'}
          />
          <Button
            title="Cancel task"
            icon="close"
            variant="danger"
            onPress={() => open('cancel')}
          />
        </>
      );
      break;
    case 'done':
      buttons = (
        <>
          <Button title="Verify" icon="verified" onPress={() => open('verify')} />
          <Button title="Send back" icon="undo" variant="soft" onPress={() => open('send_back')} />
        </>
      );
      break;
  }

  return (
    <View style={styles.actions}>
      {error && !sheet ? <Banner message={error} /> : null}
      {buttons}

      <ProofSheet
        visible={sheet === 'done'}
        hotelId={hotelId}
        busy={busy === 'done'}
        error={sheet === 'done' ? error : null}
        onClose={() => setSheet(null)}
        onSubmit={(note, photos) => run('done', { note: note || undefined, photos })}
      />

      {sheet === 'block' || sheet === 'send_back' || sheet === 'cancel' ? (
        <ReasonSheet
          key={sheet}
          copy={REASON_COPY[sheet]}
          danger={sheet === 'cancel'}
          busy={busy === sheet}
          error={error}
          onClose={() => setSheet(null)}
          onSubmit={(note) => run(sheet, { note })}
        />
      ) : null}

      <ConfirmDialog
        visible={sheet === 'verify'}
        tone="primary"
        title="Verify this task?"
        message={`You checked the work${task.doneBy ? ` ${task.doneBy.name} did` : ''} and it's done properly. This closes the task.`}
        confirmLabel="Verify"
        onConfirm={() => run('verify')}
        onCancel={() => setSheet(null)}
        busy={busy === 'verify'}
        error={sheet === 'verify' ? error : null}
      />
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function ReasonSheet({
  copy,
  danger,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  copy: { title: string; hint: string; button: string };
  danger: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <BottomSheet visible title={copy.title} onClose={onClose}>
      <View style={styles.sheet}>
        {error ? <Banner message={error} /> : null}
        <TextField
          label="Reason"
          value={note}
          onChangeText={setNote}
          placeholder={copy.hint}
          multiline
          autoFocus
          editable={!busy}
        />
        <Button
          title={copy.button}
          variant={danger ? 'danger' : 'primary'}
          onPress={() => onSubmit(note.trim())}
          disabled={!note.trim()}
          loading={busy}
        />
      </View>
    </BottomSheet>
  );
}

type Photo = { uri: string; url: string | null; failed: boolean };

/** Mark done: at least one photo or a note. Photos upload as soon as they're picked. */
function ProofSheet({
  visible,
  hotelId,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  hotelId: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (note: string, photos: string[]) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState('');
  const [pickError, setPickError] = useState<string | null>(null);

  const uploading = photos.some((p) => !p.url && !p.failed);
  const uploaded = photos.flatMap((p) => (p.url ? [p.url] : []));
  const canSubmit = !uploading && (uploaded.length > 0 || !!note.trim());

  async function pick(camera: boolean) {
    setPickError(null);
    try {
      if (camera && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setPickError('Allow camera access in Settings to take a photo.');
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;

      setPhotos((list) => [...list, { uri: asset.uri, url: null, failed: false }]);
      try {
        const url = await tasksApi.uploadPhoto(hotelId, asset);
        setPhotos((list) => list.map((p) => (p.uri === asset.uri ? { ...p, url } : p)));
      } catch (e) {
        setPhotos((list) => list.map((p) => (p.uri === asset.uri ? { ...p, failed: true } : p)));
        setPickError(errorMessage(e));
      }
    } catch (e) {
      setPickError(errorMessage(e));
    }
  }

  return (
    <BottomSheet visible={visible} title="Mark done" onClose={onClose}>
      <View style={styles.sheet}>
        <ThemedText type="small" themeColor="textSecondary">
          Add a photo or a note as proof. Someone else will then verify it.
        </ThemedText>
        {error || pickError ? <Banner message={(error ?? pickError) as string} /> : null}

        <View style={styles.photos}>
          {photos.map((p) => (
            <View key={p.uri} style={styles.thumbWrap}>
              <Image source={{ uri: p.url ? apiFileUrl(p.url) : p.uri }} style={styles.thumb} />
              {!p.url ? (
                <View style={styles.thumbOverlay}>
                  <ThemedText type="small" style={styles.overlayText}>
                    {p.failed ? 'Failed' : 'Uploading…'}
                  </ThemedText>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => setPhotos((list) => list.filter((x) => x.uri !== p.uri))}
                style={styles.remove}
              >
                <Icon name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
        {photos.length < MAX_TASK_PHOTOS ? (
          <View style={styles.row}>
            {Platform.OS !== 'web' ? (
              <Button title="Take photo" icon="camera" variant="soft" onPress={() => pick(true)} />
            ) : null}
            <Button
              title={Platform.OS === 'web' ? 'Add photo' : 'Choose photo'}
              icon="image"
              variant="soft"
              onPress={() => pick(false)}
            />
          </View>
        ) : null}

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="What was done, anything to know"
          multiline
          editable={!busy}
        />
        <Button
          title="Mark done"
          icon="check"
          onPress={() => onSubmit(note.trim(), uploaded)}
          disabled={!canSubmit}
          loading={busy}
        />
      </View>
    </BottomSheet>
  );
}

const THUMB = 76;

const styles = StyleSheet.create({
  actions: { gap: Spacing.two + 4 },
  sheet: { gap: Spacing.three, paddingBottom: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two + 4, flexWrap: 'wrap' },
  photos: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radius.md, backgroundColor: '#EEF2F2' },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#FFFFFF', fontSize: 11 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
