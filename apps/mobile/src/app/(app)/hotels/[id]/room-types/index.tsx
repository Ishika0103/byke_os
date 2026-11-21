import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupedList } from '@/components/ui/grouped-list';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { Colors, Spacing } from '@/constants/theme';
import { useHotelDetail } from '@/features/hotels';
import { RoomTypeListItem, useRoomTypeList } from '@/features/room-types';

export default function RoomTypesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { hotel } = useHotelDetail(id);
  const [search, setSearch] = useState('');
  const list = useRoomTypeList(id, search);

  return (
    <View style={styles.root}>
      <PageHeader
        back
        title="Room types"
        subtitle={hotel?.name ?? ' '}
        right={
          <HeaderButton
            icon="add"
            label="Add room type"
            onPress={() => router.push({ pathname: '/hotels/[id]/room-types/new', params: { id } })}
          />
        }
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search name or code" />
      </PageHeader>

      <GroupedList
        items={list.items}
        keyOf={(t) => t.id}
        renderRow={(item) => (
          <RoomTypeListItem
            roomType={item}
            onPress={() =>
              router.push({
                pathname: '/hotels/[id]/room-types/[typeId]',
                params: { id, typeId: item.id },
              })
            }
          />
        )}
        countLabel={list.total === 1 ? '1 room type' : `${list.total} room types`}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        empty={
          search
            ? { icon: 'search', title: 'No room types match', body: 'Try another name or code.' }
            : {
                icon: 'bed',
                title: 'No room types yet',
                body: 'Tap + to add one, e.g. Deluxe Room. Then add rooms to it.',
              }
        }
        bottomSpace={insets.bottom + Spacing.four}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
});
