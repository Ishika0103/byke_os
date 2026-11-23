import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { useHotel } from '@/features/hotels';
import { TaskForm } from '@/features/tasks';

export default function NewTaskScreen() {
  const { hotel } = useHotel();
  if (!hotel) {
    return (
      <Screen header={<PageHeader back title="Add task" />}>
        <EmptyState icon="hotel" title="No hotel selected" body="Choose a hotel on Home first." />
      </Screen>
    );
  }
  return (
    <TaskForm
      hotelId={hotel.id}
      header={<PageHeader back title="Add task" subtitle={hotel.name} />}
      onSaved={(tasks) =>
        // One task: open it. Several (one per room): back to the list.
        tasks.length === 1
          ? router.replace({
              pathname: '/tasks/[id]',
              params: { id: tasks[0].id, hotelId: hotel.id },
            })
          : router.back()
      }
    />
  );
}
