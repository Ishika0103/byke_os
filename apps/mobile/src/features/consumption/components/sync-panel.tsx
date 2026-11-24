import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ConsumptionSyncResult } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoaderOverlay } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { ApiClientError } from '@/lib/api-client';
import { errorMessage } from '@/lib/form-errors';
import { consumptionApi } from '../api/consumption.api';

const BUSY_TEXT = {
  preview: { label: 'Reading the sheet…', hint: 'This can take a few seconds.' },
  save: { label: 'Saving…', hint: 'Please keep this screen open.' },
} as const;

/** Plan 12: read the Google Sheet (preview), then save the changes. */
export function SyncPanel({ header }: { header: ReactNode }) {
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConsumptionSyncResult | null>(null);

  async function run(kind: 'preview' | 'save') {
    setBusy(kind);
    setError(null);
    try {
      setResult(await consumptionApi.sync(kind === 'preview'));
    } catch (e) {
      setResult(null);
      setError(
        e instanceof ApiClientError && e.code === 'SHEET_UNAVAILABLE'
          ? 'The Google Sheet could not be read right now. Check that it is shared and try again in a moment.'
          : errorMessage(e),
      );
    } finally {
      setBusy(null);
    }
  }

  const changes = result ? result.created + result.updated : 0;
  const isPreview = !!result && !result.saved;

  return (
    <Screen
      header={header}
      footer={
        isPreview ? (
          <Button
            title={
              changes ? `Save ${changes} change${changes === 1 ? '' : 's'}` : 'Nothing to save'
            }
            icon="check"
            onPress={() => run('save')}
            loading={busy === 'save'}
            disabled={changes === 0 || !!busy}
          />
        ) : undefined
      }
    >
      <LoaderOverlay
        visible={!!busy}
        label={BUSY_TEXT[busy ?? 'preview'].label}
        hint={BUSY_TEXT[busy ?? 'preview'].hint}
      />
      {error ? <Banner message={error} /> : null}

      <SectionLabel title="1. Check the sheet" />
      <Card>
        <ThemedText type="caption" themeColor="textSecondary">
          Reads the consumption Google Sheet and shows what would change. Nothing is saved until you
          confirm.
        </ThemedText>
        <Button
          title="Check the sheet"
          icon="sync"
          variant="secondary"
          onPress={() => run('preview')}
          loading={busy === 'preview'}
          disabled={!!busy}
        />
      </Card>

      {result ? (
        <>
          <SectionLabel title={result.saved ? 'Saved' : '2. Check, then save'} />
          <View style={styles.tiles}>
            <Tile label="New" value={result.created} />
            <Tile label="Updated" value={result.updated} />
            <Tile label="Unchanged" value={result.unchanged} />
            <Tile label="Rejected" value={result.rejected} bad />
          </View>
          {result.issues.length > 0 ? (
            <Card>
              <ThemedText style={styles.listTitle}>Values that will be skipped</ThemedText>
              {result.issues.slice(0, 50).map((issue, i) => (
                <ThemedText key={`${issue.row}-${i}`} type="small" themeColor="textSecondary">
                  Row {issue.row}: {issue.message}
                </ThemedText>
              ))}
              {result.issues.length > 50 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  …and {result.issues.length - 50} more
                </ThemedText>
              ) : null}
            </Card>
          ) : null}
        </>
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
