import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { SearchField } from '@/components/ui/search-field';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

export type Option = { value: string; label: string; description?: string };

/**
 * Bottom sheet listing options; the current one is ticked and scrolled into view. Used by
 * every dropdown. `searchable` adds a search box that filters by label and description.
 */
export function OptionDialog({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder = 'Search',
}: {
  visible: boolean;
  title: string;
  options: Option[];
  value: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState('');
  const { height } = useWindowDimensions();
  const rowHeight = options.some((o) => o.description) ? 64 : 52;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  const selectedIndex = shown.findIndex((o) => o.value === value);

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} title={title} onClose={close}>
      {searchable ? (
        <View style={styles.search}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            filled
          />
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        // A fixed height for searchable lists so the sheet doesn't jump while filtering.
        style={searchable ? { height: Math.min(380, height * 0.42) } : styles.fit}
        getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
        initialScrollIndex={selectedIndex > 3 ? selectedIndex - 2 : undefined}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing matches “{query.trim()}”
          </ThemedText>
        }
        renderItem={({ item }) => {
          const isSelected = item.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                onSelect(item.value);
                close();
              }}
              style={({ pressed }) => [
                styles.option,
                { height: rowHeight },
                isSelected && { backgroundColor: Colors.backgroundSelected },
                pressed && { backgroundColor: Colors.primaryLight },
              ]}
            >
              <View style={styles.texts}>
                <ThemedText
                  style={[styles.text, isSelected && { color: Colors.primaryPressed }]}
                  numberOfLines={1}
                >
                  {item.label}
                </ThemedText>
                {item.description ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.description}
                  </ThemedText>
                ) : null}
              </View>
              {isSelected ? <Icon name="check" size={20} color={Colors.primary} /> : null}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fit: { flexGrow: 0 },
  search: { marginBottom: Spacing.two },
  option: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  texts: { flex: 1, minWidth: 0 },
  text: { fontFamily: FontFamily.medium, fontSize: 15 },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
});
