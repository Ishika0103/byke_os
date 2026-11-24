import { router, useLocalSearchParams } from 'expo-router';

import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { Can } from '@/features/auth';
import { DayView } from '@/features/consumption';

export default function ConsumptionScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return (
    <DayView
      key={date}
      initialDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
      header={
        <PageHeader
          back
          title="Consumption"
          subtitle="Consumption marked per property"
          right={
            <Can permission="add-consumption">
              <HeaderButton
                icon="sync"
                label="Sync"
                onPress={() => router.push('/consumption/sync')}
              />
            </Can>
          }
        />
      }
    />
  );
}
