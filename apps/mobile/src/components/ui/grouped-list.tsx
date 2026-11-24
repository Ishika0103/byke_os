import type { ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader } from '@/components/ui/loader';
import { type IconName } from '@/components/ui/icon';
import { SkeletonList } from '@/components/ui/skeleton';
import { Colors, Layout, MaxContentWidth, Shadow, Spacing } from '@/constants/theme';

/**
 * A paged list drawn as one white card with divider rows (smartcal style): skeleton while
 * loading, empty / error state, pull to refresh and load-more at the end.
 */
export function GroupedList<T>({
  items,
  keyOf,
  renderRow,
  countLabel,
  loading,
  error,
  onRetry,
  refreshing,
  onRefresh,
  onEndReached,
  loadingMore,
  empty,
  bottomSpace,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactElement;
  /** e.g. "12 users", shown above the card. */
  countLabel?: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  loadingMore: boolean;
  empty: { icon: IconName; title: string; body?: string };
  bottomSpace: number;
}) {
  const last = items.length - 1;

  return (
    <FlatList
      data={loading ? [] : items}
      keyExtractor={keyOf}
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.item,
            index === 0 && styles.first,
            index === last && styles.last,
            index === 0 && Shadow.card,
          ]}
        >
          {index > 0 ? <View style={styles.divider} /> : null}
          {renderRow(item)}
        </View>
      )}
      ListHeaderComponent={
        countLabel && !loading && !error && items.length > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.count}>
            {countLabel}
          </ThemedText>
        ) : undefined
      }
      ListEmptyComponent={
        loading ? (
          <SkeletonList />
        ) : error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={onRetry} />
        ) : (
          <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
        )
      }
      ListFooterComponent={loadingMore ? <Loader style={styles.more} /> : undefined}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  count: { marginBottom: Spacing.two, marginLeft: Spacing.one },
  item: { backgroundColor: Colors.background, overflow: 'hidden' },
  first: { borderTopLeftRadius: Layout.cardRadius, borderTopRightRadius: Layout.cardRadius },
  last: { borderBottomLeftRadius: Layout.cardRadius, borderBottomRightRadius: Layout.cardRadius },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 76,
    marginRight: Spacing.three + 2,
  },
  more: { marginVertical: Spacing.three },
});
