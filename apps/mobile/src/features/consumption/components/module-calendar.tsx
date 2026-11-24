import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useHotel } from '@/features/hotels';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { todayIso } from '../dates';
import { useConsumptionRange } from '../hooks/use-consumption';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

/** One module for the selected hotel: a month grid, green = marked, red = not marked, grey = no data. */
export function ModuleCalendar({ module, header }: { module: string; header: ReactNode }) {
  const { hotel } = useHotel();
  const today = todayIso();
  const [ym, setYm] = useState(() => ({
    y: Number(today.slice(0, 4)),
    m: Number(today.slice(5, 7)),
  }));
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay();
  const prefix = `${ym.y}-${pad(ym.m)}`;
  const { marks, loading, error, reload } = useConsumptionRange(
    hotel?.id,
    module,
    `${prefix}-01`,
    `${prefix}-${pad(daysInMonth)}`,
  );
  const { refreshing, onRefresh } = usePullRefresh(reload);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(ym.y, ym.m - 1 + delta, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <Screen header={header} onRefresh={onRefresh} refreshing={refreshing}>
      {!hotel ? (
        <EmptyState icon="hotel" title="No hotel selected" body="Pick a hotel on Home first." />
      ) : (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            {hotel.name}
          </ThemedText>
          <View style={styles.stepper}>
            <Button title="Previous" icon="back" variant="soft" compact onPress={() => shift(-1)} />
            <ThemedText style={styles.month}>
              {MONTHS[ym.m - 1]} {ym.y}
            </ThemedText>
            <Button
              title="Next"
              icon="chevronRight"
              variant="soft"
              compact
              onPress={() => shift(1)}
            />
          </View>

          {error ? <Banner message={error} /> : null}
          {loading ? <Loader label="Loading…" style={styles.loader} /> : null}

          <Card>
            <View style={styles.week}>
              {WEEKDAYS.map((w, i) => (
                <ThemedText
                  key={i}
                  type="caption"
                  themeColor="textSecondary"
                  style={styles.weekday}
                >
                  {w}
                </ThemedText>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.week}>
                {week.map((day, di) => {
                  if (day === null) return <View key={di} style={styles.slot} />;
                  const iso = `${prefix}-${pad(day)}`;
                  const mark = marks[iso];
                  const bg =
                    mark === 1 ? Colors.success : mark === 0 ? Colors.error : Colors.border;
                  return (
                    <View key={di} style={styles.slot}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${day} ${MONTHS[ym.m - 1]}`}
                        onPress={() =>
                          router.push({ pathname: '/consumption' as never, params: { date: iso } })
                        }
                        style={[styles.day, { backgroundColor: bg }, iso === today && styles.today]}
                      >
                        <ThemedText
                          style={[styles.dayText, mark === undefined && { color: Colors.text }]}
                        >
                          {day}
                        </ThemedText>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </Card>

          <View style={styles.legend}>
            <Legend color={Colors.success} label="Marked" />
            <Legend color={Colors.error} label="Not marked" />
            <Legend color={Colors.border} label="No data" />
          </View>
        </>
      )}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontFamily: FontFamily.semiBold, fontSize: 17 },
  loader: { paddingVertical: Spacing.three },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingBottom: Spacing.one },
  slot: { flex: 1, padding: 2 },
  day: {
    aspectRatio: 1,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 2, borderColor: Colors.text },
  dayText: { fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.textOnPrimary },
  legend: { flexDirection: 'row', gap: Spacing.three, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
