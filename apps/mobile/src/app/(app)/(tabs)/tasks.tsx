import { DEPARTMENTS, type DepartmentKey, type TaskView } from '@byke-os/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTabBarSpace } from '@/components/app-tab-bar';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { GroupedList } from '@/components/ui/grouped-list';
import { OptionDialog } from '@/components/ui/option-dialog';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { Colors, Spacing } from '@/constants/theme';
import { useHotel } from '@/features/hotels';
import { TaskListItem, useNow, useTaskList } from '@/features/tasks';

const VIEWS: { value: TaskView; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'waiting', label: 'To verify' },
  { value: 'closed', label: 'Closed' },
];
const ALL = 'all';

export default function TasksScreen() {
  const { hotel } = useHotel();
  const params = useLocalSearchParams<{ view?: TaskView }>();
  const bottomSpace = useTabBarSpace();
  const now = useNow();
  const [view, setView] = useState<TaskView>(params.view ?? 'open');
  const [mine, setMine] = useState(false);
  const [department, setDepartment] = useState<DepartmentKey | null>(null);
  const [search, setSearch] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);

  // Home links here with ?view=…; follow it when it changes.
  const [viewParam, setViewParam] = useState(params.view);
  if (params.view !== viewParam) {
    setViewParam(params.view);
    if (params.view) setView(params.view);
  }

  const list = useTaskList(hotel?.id ?? '', { view, mine, department, search });
  const deptLabel = DEPARTMENTS.find((d) => d.key === department)?.label ?? 'All departments';

  return (
    <View style={styles.root}>
      <PageHeader
        title="Tasks"
        subtitle={hotel?.name ?? 'No hotel selected'}
        right={
          hotel ? (
            <HeaderButton icon="add" label="Add task" onPress={() => router.push('/tasks/new')} />
          ) : undefined
        }
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search tasks" />
        <View style={styles.chips}>
          {VIEWS.map((v) => (
            <Chip
              key={v.value}
              onDark
              label={v.label}
              selected={view === v.value}
              onPress={() => setView(v.value)}
            />
          ))}
          <Chip onDark label="Mine" selected={mine} onPress={() => setMine(!mine)} />
          <Chip
            onDark
            dropdown
            label={deptLabel}
            selected={!!department}
            onPress={() => setDeptOpen(true)}
          />
        </View>
      </PageHeader>

      {hotel ? (
        <GroupedList
          items={list.items}
          keyOf={(t) => t.id}
          renderRow={(item) => (
            <TaskListItem
              task={item}
              now={now}
              onPress={() =>
                router.push({
                  pathname: '/tasks/[id]',
                  params: { id: item.id, hotelId: hotel.id },
                })
              }
            />
          )}
          countLabel={list.total === 1 ? '1 task' : `${list.total} tasks`}
          loading={list.loading}
          error={list.error}
          onRetry={list.retry}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          onEndReached={list.loadMore}
          loadingMore={list.loadingMore}
          empty={
            search || mine || department
              ? { icon: 'search', title: 'No tasks match', body: 'Try other filters.' }
              : view === 'open'
                ? { icon: 'tasks', title: 'Nothing open', body: 'Tap + to add a task.' }
                : view === 'waiting'
                  ? { icon: 'verified', title: 'Nothing to verify', body: 'Done tasks show here.' }
                  : { icon: 'tasks', title: 'No closed tasks yet' }
          }
          bottomSpace={bottomSpace}
        />
      ) : (
        <View style={styles.empty}>
          <EmptyState icon="hotel" title="No hotel selected" body="Choose a hotel on Home." />
        </View>
      )}

      <OptionDialog
        visible={deptOpen}
        title="Department"
        options={[
          { value: ALL, label: 'All departments' },
          ...DEPARTMENTS.map((d) => ({ value: d.key, label: d.label })),
        ]}
        value={department ?? ALL}
        onSelect={(v) => {
          setDepartment(v === ALL ? null : (v as DepartmentKey));
          setDeptOpen(false);
        }}
        onClose={() => setDeptOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  empty: { padding: Spacing.three },
});
