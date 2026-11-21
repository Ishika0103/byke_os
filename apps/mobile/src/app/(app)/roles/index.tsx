import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupedList } from '@/components/ui/grouped-list';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { Colors, Spacing } from '@/constants/theme';
import { RoleListItem, useRoleList } from '@/features/roles';

export default function RolesScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const list = useRoleList(search);

  return (
    <View style={styles.root}>
      <PageHeader
        back
        title="Roles"
        subtitle="Job roles you can give to users"
        right={
          <HeaderButton icon="add" label="Add role" onPress={() => router.push('/roles/new')} />
        }
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search roles" />
      </PageHeader>

      <GroupedList
        items={list.items}
        keyOf={(r) => r.id}
        renderRow={(item) => (
          <RoleListItem
            role={item}
            onPress={() => router.push({ pathname: '/roles/[id]', params: { id: item.id } })}
          />
        )}
        countLabel={list.total === 1 ? '1 role' : `${list.total} roles`}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        empty={
          search
            ? { icon: 'search', title: 'No roles match', body: 'Try another name.' }
            : { icon: 'roles', title: 'No roles yet', body: 'Tap + to add the first one.' }
        }
        bottomSpace={insets.bottom + Spacing.four}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
});
