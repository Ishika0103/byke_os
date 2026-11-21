import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupedList } from '@/components/ui/grouped-list';
import { HeaderButton, PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { Colors, Spacing } from '@/constants/theme';
import { HotelListItem, useHotelList } from '@/features/hotels';

export default function HotelsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const list = useHotelList(search);

  return (
    <View style={styles.root}>
      <PageHeader
        back
        title="Hotels"
        subtitle="Byke properties on Byke OS"
        right={
          <HeaderButton icon="add" label="Add hotel" onPress={() => router.push('/hotels/new')} />
        }
      >
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, code or city"
        />
      </PageHeader>

      <GroupedList
        items={list.items}
        keyOf={(h) => h.id}
        renderRow={(item) => (
          <HotelListItem
            hotel={item}
            onPress={() => router.push({ pathname: '/hotels/[id]', params: { id: item.id } })}
          />
        )}
        countLabel={list.total === 1 ? '1 hotel' : `${list.total} hotels`}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        empty={
          search
            ? { icon: 'search', title: 'No hotels match', body: 'Try another name, code or city.' }
            : { icon: 'hotel', title: 'No hotels yet', body: 'Tap + to add the first one.' }
        }
        bottomSpace={insets.bottom + Spacing.four}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
});
