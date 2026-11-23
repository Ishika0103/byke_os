import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupedList } from '@/components/ui/grouped-list';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { Colors, Spacing } from '@/constants/theme';
import { Can } from '@/features/auth';
import { DepartmentListItem, useDepartmentList } from '@/features/departments';

export default function DepartmentsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const list = useDepartmentList(search);

  return (
    <View style={styles.root}>
      <PageHeader
        back
        title="Departments"
        subtitle="Teams that users and tasks belong to"
        right={
          <Can permission="add-department">
            <HeaderButton
              icon="add"
              label="Add department"
              onPress={() => router.push('/departments/new')}
            />
          </Can>
        }
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search departments" />
      </PageHeader>

      <GroupedList
        items={list.items}
        keyOf={(d) => d.id}
        renderRow={(item) => (
          <DepartmentListItem
            department={item}
            onPress={() => router.push({ pathname: '/departments/[id]', params: { id: item.id } })}
          />
        )}
        countLabel={list.total === 1 ? '1 department' : `${list.total} departments`}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        empty={
          search
            ? { icon: 'search', title: 'No departments match', body: 'Try another name.' }
            : { icon: 'users', title: 'No departments yet', body: 'Tap + to add the first one.' }
        }
        bottomSpace={insets.bottom + Spacing.four}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
});
