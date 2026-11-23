import { formatLocation, SUPER_ADMIN_ROLE_CODE } from '@byke-os/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { CardList } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useAuth, usePermission } from '@/features/auth';
import { useApiStatus } from '@/features/health';
import { formatTime, HotelSwitcher, useHotel } from '@/features/hotels';
import { useRoomCounts } from '@/features/rooms';
import { useTaskSummary } from '@/features/tasks';

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  // Each time Home is shown, pick up permission changes made by an admin.
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser]),
  );
  const { hotel, loading, error, reloadHotels } = useHotel();
  const { status, database } = useApiStatus();
  const canAddHotel = usePermission('add-hotel');
  const canTasks = usePermission('view-task');
  const counts = useRoomCounts(hotel?.id);
  const tasks = useTaskSummary(canTasks ? hotel?.id : null);
  const n = (v: number | undefined) => (v === undefined ? '–' : String(v));
  const goTasks = (view: 'open' | 'waiting' | 'closed') =>
    router.navigate({ pathname: '/tasks', params: { view } });
  const roomsLabel =
    counts?.rooms !== undefined
      ? ` · ${counts.rooms === 1 ? '1 room' : `${counts.rooms} rooms`}`
      : '';

  const online = status === 'online' && database === 'connected';
  const statusLabel =
    status === 'checking' ? 'Checking…' : online ? 'All systems online' : 'Service unavailable';

  return (
    <Screen
      tabs
      header={
        <PageHeader
          top={
            <View style={styles.topRow}>
              <HotelSwitcher />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => router.navigate('/profile')}
              >
                {user ? <Avatar name={user.name} size={40} inverted /> : null}
              </Pressable>
            </View>
          }
        >
          <View>
            <ThemedText type="small" style={styles.muted}>
              {greeting()},
            </ThemedText>
            <ThemedText style={styles.name} numberOfLines={1}>
              {user?.name ?? 'there'}
            </ThemedText>
          </View>
        </PageHeader>
      }
    >
      {hotel ? (
        canTasks ? (
          <>
            <SectionLabel title="Tasks" />
            <CardList>
              <ListRow
                icon="warning"
                title="Late"
                subtitle="Open tasks past their due time"
                value={n(tasks?.overdue)}
                danger={!!tasks?.overdue}
                onPress={() => goTasks('open')}
              />
              <ListRow
                icon="tasks"
                title="Open"
                subtitle="Pending, in progress or blocked"
                value={n(tasks?.open)}
                onPress={() => goTasks('open')}
              />
              <ListRow
                icon="verified"
                title="Waiting to verify"
                subtitle="Done, needs a second person to check"
                value={n(tasks?.waiting)}
                onPress={() => goTasks('waiting')}
              />
              <ListRow
                icon="check"
                title="Verified today"
                subtitle="Closed with proof"
                value={n(tasks?.closedToday)}
                onPress={() => goTasks('closed')}
              />
            </CardList>
          </>
        ) : user && user.permissions.length === 0 ? (
          <EmptyState
            icon="roles"
            title="No access yet"
            body="You don't have access to anything yet. Ask your admin."
          />
        ) : null
      ) : loading ? (
        <SkeletonList rows={2} />
      ) : error ? (
        <EmptyState
          icon="warning"
          title="Couldn't load hotels"
          body={error}
          error
          onRetry={reloadHotels}
        />
      ) : user?.role?.code !== SUPER_ADMIN_ROLE_CODE ? (
        <EmptyState
          icon="hotel"
          title="No hotel yet"
          body="You're not added to any hotel yet. Ask your admin."
        />
      ) : (
        <EmptyState
          icon="hotel"
          title="No hotels yet"
          body="Add your first property to start using Byke OS."
          action={
            canAddHotel
              ? { label: 'Add hotel', onPress: () => router.push('/hotels/new') }
              : undefined
          }
        />
      )}

      <SectionLabel title="Property" />
      <CardList>
        {hotel ? (
          <ListRow
            icon="hotel"
            title={hotel.name}
            subtitle={`${formatLocation(hotel.location)}${roomsLabel} · Check-in ${formatTime(hotel.checkInTime)}`}
            value={hotel.code}
            onPress={() => router.push({ pathname: '/hotels/[id]', params: { id: hotel.id } })}
          />
        ) : null}
        <ListRow
          icon="server"
          title="Byke OS server"
          subtitle={statusLabel}
          trailing={
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    status === 'checking'
                      ? Colors.textSecondary
                      : online
                        ? Colors.success
                        : Colors.error,
                },
              ]}
            />
          }
        />
      </CardList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: Colors.textOnPrimaryMuted },
  name: { fontFamily: FontFamily.bold, fontSize: 26, lineHeight: 38, color: Colors.textOnPrimary },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.one },
});
