import { SUPER_ADMIN_ROLE_CODE } from '@byke-os/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { HotelSwitcher, useHotel } from '@/features/hotels';
import { NotificationBell } from '@/features/notifications';
import { ConsumptionHomeSection } from '@/features/consumption';
import { useTaskSummary } from '@/features/tasks';
import { usePullRefresh } from '@/hooks/use-pull-refresh';

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
  const canAddHotel = usePermission('add-hotel');
  const canTasks = usePermission('view-task');
  const canConsumption = usePermission('view-consumption');
  const [refreshKey, setRefreshKey] = useState(0);
  const tasks = useTaskSummary(canTasks ? hotel?.id : null, refreshKey);
  const { refreshing, onRefresh } = usePullRefresh(async () => {
    setRefreshKey((n) => n + 1);
    reloadHotels();
    await refreshUser();
  });
  const n = (v: number | undefined) => (v === undefined ? '–' : String(v));
  const goTasks = (view: 'open' | 'waiting' | 'closed') =>
    router.navigate({ pathname: '/tasks', params: { view } });

  return (
    <Screen
      tabs
      onRefresh={onRefresh}
      refreshing={refreshing}
      header={
        <PageHeader
          top={
            <View style={styles.topRow}>
              <HotelSwitcher />
              <View style={styles.actions}>
                <NotificationBell refreshKey={refreshKey} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                  onPress={() => router.navigate('/profile')}
                >
                  {user ? <Avatar name={user.name} size={40} inverted /> : null}
                </Pressable>
              </View>
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
        canTasks || canConsumption ? (
          <>
            {canTasks ? (
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
                    subtitle="Pending or in progress"
                    value={n(tasks?.open)}
                    onPress={() => goTasks('open')}
                  />
                  <ListRow
                    icon="verified"
                    title="Waiting to verify"
                    subtitle="Done, waiting to be verified"
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
            ) : null}
            {canConsumption ? (
              <ConsumptionHomeSection hotelId={hotel.id} refreshKey={refreshKey} />
            ) : null}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  muted: { color: Colors.textOnPrimaryMuted },
  name: { fontFamily: FontFamily.bold, fontSize: 26, lineHeight: 38, color: Colors.textOnPrimary },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.one },
});
