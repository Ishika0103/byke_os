import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Can } from '@/features/auth';
import { Chip } from '@/components/ui/chip';
import { GroupedList } from '@/components/ui/grouped-list';
import { OptionDialog } from '@/components/ui/option-dialog';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { Colors, Spacing } from '@/constants/theme';
import { useHotelDetail } from '@/features/hotels';
import { useRoomTypeOptions } from '@/features/room-types';
import { RoomListItem, useRoomList } from '@/features/rooms';

const ALL = 'all';

export default function RoomsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { hotel } = useHotelDetail(id);
  const types = useRoomTypeOptions(id, false);
  const [search, setSearch] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const list = useRoomList(id, search, roomTypeId);

  const typeLabel = types.options.find((o) => o.value === roomTypeId)?.label ?? 'All room types';

  return (
    <View style={styles.root}>
      <PageHeader
        back
        title="Rooms"
        subtitle={hotel?.name ?? ' '}
        right={
          <View style={styles.actions}>
            <Can permission="add-room">
              <HeaderButton
                icon="upload"
                label="Import rooms from Excel"
                onPress={() =>
                  router.push({ pathname: '/hotels/[id]/rooms/import', params: { id } })
                }
              />
            </Can>
            <Can permission="add-room">
              <HeaderButton
                icon="addMany"
                label="Add many rooms"
                onPress={() => router.push({ pathname: '/hotels/[id]/rooms/bulk', params: { id } })}
              />
              <HeaderButton
                icon="add"
                label="Add room"
                onPress={() => router.push({ pathname: '/hotels/[id]/rooms/new', params: { id } })}
              />
            </Can>
          </View>
        }
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search room number" />
        <View style={styles.chips}>
          <Chip
            onDark
            label={typeLabel}
            selected={!!roomTypeId}
            dropdown
            onPress={() => setPickerOpen(true)}
          />
        </View>
      </PageHeader>

      <GroupedList
        items={list.items}
        keyOf={(r) => r.id}
        renderRow={(item) => (
          <RoomListItem
            room={item}
            onPress={() =>
              router.push({
                pathname: '/hotels/[id]/rooms/[roomId]',
                params: { id, roomId: item.id },
              })
            }
          />
        )}
        countLabel={list.total === 1 ? '1 room' : `${list.total} rooms`}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        empty={
          search || roomTypeId
            ? { icon: 'search', title: 'No rooms match', body: 'Try another number or room type.' }
            : {
                icon: 'bed',
                title: 'No rooms yet',
                body: 'Add one room with +, or a range like 101 to 120 with the button next to it.',
              }
        }
        bottomSpace={insets.bottom + Spacing.four}
      />

      <OptionDialog
        visible={pickerOpen}
        title="Room type"
        options={[{ value: ALL, label: 'All room types' }, ...types.options]}
        value={roomTypeId ?? ALL}
        onSelect={(v) => {
          setRoomTypeId(v === ALL ? null : v);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
  actions: { flexDirection: 'row', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
