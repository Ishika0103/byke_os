import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Notification } from '@byke-os/shared';

import { GroupedList } from '@/components/ui/grouped-list';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { NotificationItem, notificationsApi, useNotificationList } from '@/features/notifications';

export default function NotificationsScreen() {
  const list = useNotificationList();
  // Rows opened in this session show as read straight away.
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [allRead, setAllRead] = useState(false);

  const items = list.items.map((n) =>
    n.readAt || !(allRead || readIds.has(n.id)) ? n : { ...n, readAt: new Date().toISOString() },
  );
  const hasUnread = items.some((n) => !n.readAt);

  function open(n: Notification) {
    if (!n.readAt) {
      setReadIds((prev) => new Set(prev).add(n.id));
      notificationsApi.markRead(n.id).catch(() => undefined);
    }
    if (n.taskId) {
      router.push({ pathname: '/tasks/[id]', params: { id: n.taskId, hotelId: n.hotelId } });
    }
  }

  async function markAll() {
    setAllRead(true);
    await notificationsApi.markAllRead().catch(() => undefined);
  }

  return (
    <View style={styles.root}>
      <PageHeader
        back
        title="Notifications"
        right={
          hasUnread ? (
            <HeaderButton icon="check" label="Mark all read" onPress={markAll} />
          ) : undefined
        }
      />
      <GroupedList
        items={items}
        keyOf={(n) => n.id}
        renderRow={(n) => <NotificationItem notification={n} onPress={() => open(n)} />}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        refreshing={list.refreshing}
        onRefresh={() => {
          setAllRead(false);
          setReadIds(new Set());
          return list.refresh();
        }}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        empty={{ icon: 'bell', title: 'No notifications yet' }}
        bottomSpace={24}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
});
