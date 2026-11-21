import { formatLocation } from '@byke-os/shared';
import { router } from 'expo-router';
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
import { useAuth } from '@/features/auth';
import { useApiStatus } from '@/features/health';
import { formatTime, HotelSwitcher, useHotel } from '@/features/hotels';
import { useRoomCounts } from '@/features/rooms';
import { useTaskSummary } from '@/features/tasks';

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { hotel, loading, error, reloadHotels } = useHotel();
  const { status, database } = useApiStatus();
  const counts = useRoomCounts(hotel?.id);
  const tasks = useTaskSummary(hotel?.id);
  const n = (v: number | undefined) => (v === undefined ? '–' : String(v));
  const goTasks = (view: 'open' | 'waiting' | 'closed') =>
    router.navigate({ pathname: '/tasks', params: { view } });
  const roomsLabel = counts ? ` · ${counts.rooms === 1 ? '1 room' : `${counts.rooms} rooms`}` : '';

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
                accessibilityLabel="Profile"
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
      ) : (
        <EmptyState
          icon="hotel"
          title="No hotels yet"
          body="Add your first property to start using Byke OS."
          action={{ label: 'Add hotel', onPress: () => router.push('/hotels/new') }}
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
