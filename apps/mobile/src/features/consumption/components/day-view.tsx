import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ConsumptionSummary } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Loader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { addDays, formatDay, todayIso } from '../dates';
import { useConsumptionSummary } from '../hooks/use-consumption';

/** Plan 12: one day, a card per property with a mark per module, plus the Total. */
export function DayView({ header, initialDate }: { header: ReactNode; initialDate?: string }) {
  const [date, setDate] = useState(initialDate ?? todayIso());
  const { summary, loading, error, reload } = useConsumptionSummary(date);
  const { refreshing, onRefresh } = usePullRefresh(reload);

  return (
    <Screen header={header} onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.stepper}>
        <Button
          title="Previous"
          icon="back"
          variant="soft"
          compact
          onPress={() => setDate(addDays(date, -1))}
        />
        <ThemedText style={styles.date}>{formatDay(date)}</ThemedText>
        <Button
          title="Next"
          icon="chevronRight"
          variant="soft"
          compact
          onPress={() => setDate(addDays(date, 1))}
        />
      </View>
      {date !== todayIso() ? (
        <Button title="Today" variant="soft" compact onPress={() => setDate(todayIso())} />
      ) : null}

      {error ? <Banner message={error} /> : null}
      {loading ? <Loader label="Loading…" style={styles.loader} /> : null}

      {!loading && summary && summary.rows.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">No properties to show for this day.</ThemedText>
        </Card>
      ) : null}

      {!loading && summary && summary.rows.length > 0 ? (
        <>
          <TotalCard summary={summary} />
          {summary.rows.map((row) => (
            <Card key={row.hotelId}>
              <ThemedText style={styles.title}>{row.hotelName}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {row.propertyCode}
              </ThemedText>
              <ModuleTable summary={summary} cellsOf={(code) => row.cells[code]} />
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function TotalCard({ summary }: { summary: ConsumptionSummary }) {
  return (
    <Card>
      <ThemedText style={styles.title}>Total</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Properties that marked it
      </ThemedText>
      <ModuleTable
        summary={summary}
        cellsOf={() => undefined}
        totalOf={(code) => summary.totals[code]}
      />
    </Card>
  );
}

function ModuleTable({
  summary,
  cellsOf,
  totalOf,
}: {
  summary: ConsumptionSummary;
  cellsOf: (code: string) => 0 | 1 | null | undefined;
  totalOf?: (code: string) => number | undefined;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tr}>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.name}>
          Module
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.col}>
          Consumption
        </ThemedText>
      </View>
      {summary.modules.map((m) => {
        const cell = cellsOf(m.code);
        const total = totalOf?.(m.code);
        return (
          <View key={m.code} style={styles.tr}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {m.name}
            </ThemedText>
            <View style={styles.col}>
              {total !== undefined ? <Count value={total} /> : <Mark value={cell ?? null} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** 1 = marked (check), 0 = not marked, null = not in the sheet (dash). */
function Mark({ value }: { value: 0 | 1 | null }) {
  if (value === 1) return <Icon name="check" size={18} color={Colors.primary} />;
  if (value === 0) return <Icon name="close" size={16} color={Colors.error} />;
  return <ThemedText themeColor="textSecondary">–</ThemedText>;
}

function Count({ value }: { value: number }) {
  return <ThemedText style={styles.count}>{value}</ThemedText>;
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontFamily: FontFamily.semiBold, fontSize: 17 },
  loader: { paddingVertical: Spacing.four },
  title: { fontFamily: FontFamily.semiBold, fontSize: 16 },
  table: { gap: Spacing.two, marginTop: Spacing.two },
  tr: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1.4 },
  col: { flex: 1, alignItems: 'center' },
  count: { fontFamily: FontFamily.bold, fontSize: 16 },
});
