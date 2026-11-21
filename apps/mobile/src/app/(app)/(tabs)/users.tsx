import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTabBarSpace } from '@/components/app-tab-bar';
import { Chip } from '@/components/ui/chip';
import { GroupedList } from '@/components/ui/grouped-list';
import { OptionDialog } from '@/components/ui/option-dialog';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useRoleOptions } from '@/features/roles';
import { UserListItem, useUserList, type UserStatusFilter } from '@/features/users';

const ALL_ROLES = '__all__';

export default function UsersScreen() {
  const bottomSpace = useTabBarSpace();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);

  const { roles } = useRoleOptions();
  const list = useUserList({ search, roleId, status });

  const roleOptions = useMemo(
    () => [
      { value: ALL_ROLES, label: 'All roles' },
      ...roles.map((r) => ({ value: r.id, label: r.name })),
    ],
    [roles],
  );
  const roleLabel = roles.find((r) => r.id === roleId)?.name ?? 'All roles';
  const filtered = !!search || !!roleId || status !== 'all';

  return (
    <View style={styles.root}>
      <PageHeader
        back
        title="Users"
        subtitle="People who can sign in to Byke OS"
        right={
          <HeaderButton
            icon="personAdd"
            label="Add user"
            onPress={() => router.push('/users/new')}
          />
        }
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search name or email" />
        <View style={styles.chips}>
          <Chip
            onDark
            label={roleLabel}
            selected={!!roleId}
            dropdown
            onPress={() => setRolePickerOpen(true)}
          />
          <Chip
            onDark
            label="Active"
            selected={status === 'active'}
            onPress={() => setStatus(status === 'active' ? 'all' : 'active')}
          />
        </View>
      </PageHeader>

      <GroupedList
        items={list.items}
        keyOf={(u) => u.id}
        renderRow={(item) => (
          <UserListItem
            user={item}
            isSelf={item.id === me?.id}
            onPress={() => router.push({ pathname: '/users/[id]', params: { id: item.id } })}
          />
        )}
        countLabel={list.total === 1 ? '1 user' : `${list.total} users`}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        empty={
          filtered
            ? { icon: 'search', title: 'No users match', body: 'Try another name or filter.' }
            : { icon: 'users', title: 'No users yet', body: 'Tap + to add the first one.' }
        }
        bottomSpace={bottomSpace}
      />

      <OptionDialog
        visible={rolePickerOpen}
        title="Filter by role"
        options={roleOptions}
        value={roleId ?? ALL_ROLES}
        onSelect={(value) => setRoleId(value === ALL_ROLES ? null : value)}
        onClose={() => setRolePickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
