import { departmentLabel, OPEN_STAGES } from '@byke-os/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Can } from '@/features/auth';
import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { StageProgress } from '@/components/ui/stage-progress';
import { Timeline } from '@/components/ui/timeline';
import { Colors, Spacing } from '@/constants/theme';
import {
  PROGRESS_STEPS,
  StagePill,
  TaskActions,
  changeLines,
  dateTime,
  dueText,
  progressIndex,
  updateTitle,
  updateTone,
  useNow,
  useTaskDetail,
} from '@/features/tasks';
import { apiFileUrl } from '@/lib/api-client';

export default function TaskScreen() {
  const { id, hotelId } = useLocalSearchParams<{ id: string; hotelId: string }>();
  const { task, setTask, error, retry } = useTaskDetail(hotelId, id);
  const now = useNow();

  if (!task) {
    return (
      <Screen header={<PageHeader back title="Task" />}>
        {error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={retry} />
        ) : (
          <SkeletonList rows={4} />
        )}
      </Screen>
    );
  }

  const due = dueText(task, now);
  const open = OPEN_STAGES.includes(task.stage);
  const flag =
    task.stage === 'blocked'
      ? { label: 'Blocked', tone: 'warning' as const }
      : task.stage === 'cancelled'
        ? { label: 'Cancelled', tone: 'danger' as const }
        : undefined;

  return (
    <Screen
      header={
        <PageHeader
          back
          title={task.title}
          subtitle={departmentLabel(task.department)}
          right={
            open ? (
              <Can permission="edit-task">
                <HeaderButton
                  icon="edit"
                  label="Edit task"
                  onPress={() =>
                    router.push({ pathname: '/tasks/[id]/edit', params: { id: task.id, hotelId } })
                  }
                />
              </Can>
            ) : undefined
          }
        />
      }
    >
      <Card>
        <View style={styles.top}>
          <StagePill stage={task.stage} />
          <View style={styles.due}>
            <Icon name="clock" size={16} color={due.late ? Colors.error : Colors.textSecondary} />
            <ThemedText
              type="smallBold"
              style={{ color: due.late ? Colors.error : Colors.textSecondary }}
            >
              {due.text}
            </ThemedText>
          </View>
        </View>
        <StageProgress steps={PROGRESS_STEPS} current={progressIndex(task)} flag={flag} />
      </Card>

      {task.stage === 'blocked' && task.blockedReason ? (
        <Banner tone="info" message={`Blocked: ${task.blockedReason}`} />
      ) : null}

      <Can permission="edit-task">
        <TaskActions hotelId={hotelId} task={task} onChanged={setTask} />
      </Can>

      <SectionLabel title="Details" />
      <Card>
        <Detail label="Assigned to" value={task.assignee?.name ?? 'Unassigned'} />
        <Detail label="Due" value={dateTime(task.dueAt)} />
        <Detail label="Room" value={task.room ? `Room ${task.room.roomNumber}` : 'None'} />
        <Detail label="Department" value={departmentLabel(task.department)} />
        {task.description ? <Detail label="Details" value={task.description} /> : null}
        {task.doneBy ? (
          <Detail label="Done by" value={`${task.doneBy.name}, ${dateTime(task.doneAt!)}`} />
        ) : null}
        {task.verifiedBy ? (
          <Detail
            label="Verified by"
            value={`${task.verifiedBy.name}, ${dateTime(task.verifiedAt!)}`}
          />
        ) : null}
      </Card>

      <SectionLabel title="Timeline" />
      <Card>
        <Timeline
          items={task.updates.map((u) => ({
            key: u.id,
            title: updateTitle(u),
            time: dateTime(u.createdAt),
            lines: u.kind === 'edited' ? changeLines(u) : u.note ? [u.note] : [],
            photos: u.photos.map((p) => apiFileUrl(p.url)),
            tone: updateTone(u),
          }))}
        />
      </Card>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  detail: { flexDirection: 'row', gap: Spacing.three },
  label: { width: 96 },
  value: { flex: 1 },
});
