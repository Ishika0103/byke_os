import { router } from 'expo-router';

import { CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { todayIso } from '../dates';
import { useConsumptionSummary } from '../hooks/use-consumption';

/** Home: today's consumption per module for the selected hotel (check / cross / dash). */
export function ConsumptionHomeSection({
  hotelId,
  refreshKey,
}: {
  hotelId: string;
  refreshKey: number;
}) {
  const { summary, loading } = useConsumptionSummary(todayIso(), refreshKey);
  const row = summary?.rows.find((r) => r.hotelId === hotelId);

  return (
    <>
      <SectionLabel title="Consumption today" />
      {loading && !summary ? (
        <SkeletonList rows={3} />
      ) : (
        <CardList>
          {(summary?.modules ?? []).map((m) => {
            const mark = row ? row.cells[m.code] : null;
            return (
              <ListRow
                key={m.code}
                icon="chart"
                title={m.name}
                subtitle={mark === 1 ? 'Marked' : mark === 0 ? 'Not marked' : 'No data'}
                trailing={
                  mark === 1 ? (
                    <Icon name="check" size={20} color={Colors.primary} />
                  ) : mark === 0 ? (
                    <Icon name="close" size={18} color={Colors.error} />
                  ) : (
                    <ThemedText themeColor="textSecondary">–</ThemedText>
                  )
                }
                onPress={() =>
                  router.push({ pathname: '/consumption/module', params: { module: m.code } })
                }
              />
            );
          })}
        </CardList>
      )}
    </>
  );
}
