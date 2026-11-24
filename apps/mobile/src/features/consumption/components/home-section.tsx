import { router } from 'expo-router';

import { CardList } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { useConsumptionModules, useConsumptionWeek } from '../hooks/use-consumption';

/** Home: for the selected hotel, how many of the last 7 days each module was marked. */
export function ConsumptionHomeSection({
  hotelId,
  refreshKey,
}: {
  hotelId: string;
  refreshKey: number;
}) {
  const { modules } = useConsumptionModules();
  const { week, loading } = useConsumptionWeek(hotelId, refreshKey);

  return (
    <>
      <SectionLabel title="Consumption, last 7 days" />
      {loading && !week ? (
        <SkeletonList rows={3} />
      ) : (
        <CardList>
          {modules.map((m) => {
            const w = week?.[m.code];
            return (
              <ListRow
                key={m.code}
                icon="chart"
                title={m.name}
                subtitle={
                  w ? `Marked on ${w.marked} of ${w.days} days` : 'No data in the last 7 days'
                }
                value={w ? `${w.marked}/${w.days}` : '–'}
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
