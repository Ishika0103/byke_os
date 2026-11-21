import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { TaskForm, useTaskDetail } from '@/features/tasks';

export default function EditTaskScreen() {
  const { id, hotelId } = useLocalSearchParams<{ id: string; hotelId: string }>();
  const { task, error, retry } = useTaskDetail(hotelId, id);

  if (!task) {
    return (
      <Screen header={<PageHeader back title="Edit task" />}>
        {error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={retry} />
        ) : (
          <SkeletonList rows={3} />
        )}
      </Screen>
    );
  }
  return (
    <TaskForm
      key={task.id}
      hotelId={hotelId}
      task={task}
      header={<PageHeader back title="Edit task" subtitle={task.title} />}
      onSaved={() => router.back()}
    />
  );
}
