import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { Option } from '@/components/ui/option-dialog';
import { SearchField } from '@/components/ui/search-field';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

const ROW = 52;

/**
 * Labelled field to pick several options (e.g. a user's hotels). The chosen ones show as chips
 * (× removes one); tapping the field opens a sheet with search and a tick box per option.
 */
export function MultiSelectField({
  label,
  values,
  options,
  onChange,
  placeholder = 'Select…',
  error,
  hint,
  disabled,
  searchPlaceholder = 'Search',
}: {
  label: string;
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { height } = useWindowDimensions();
  const selected = options.filter((o) => values.includes(o.value));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  function close() {
    setQuery('');
    setOpen(false);
  }

  return (
    <View>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {/* The field is a View, not a button: the chips hold their own remove buttons, and a button
          can't sit inside a button on the web. A full-size button behind them opens the sheet. */}
      <View
        style={[
          styles.field,
          { borderColor: error ? Colors.error : Colors.border },
          disabled && styles.disabled,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected.map((o) => o.label).join(', ') || placeholder}`}
          accessibilityState={{ disabled: !!disabled }}
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.chips} pointerEvents="box-none">
          {selected.length === 0 ? (
            <ThemedText style={styles.placeholder}>{placeholder}</ThemedText>
          ) : (
            selected.map((o) => (
              <View key={o.value} style={styles.chip}>
                <ThemedText style={styles.chipText} numberOfLines={1}>
                  {o.label}
                </ThemedText>
                {disabled ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${o.label}`}
                    hitSlop={8}
                    onPress={() => toggle(o.value)}
                  >
                    <Icon name="close" size={16} color={Colors.primaryPressed} />
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
        <View pointerEvents="none">
          <Icon name="chevronDown" size={20} color={Colors.textSecondary} />
        </View>
      </View>
      {error ? (
        <ThemedText
          type="caption"
          themeColor="error"
          style={styles.below}
          accessibilityRole="alert"
        >
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.below}>
          {hint}
        </ThemedText>
      ) : null}

      <BottomSheet visible={open} title={label} onClose={close}>
        {options.length > 6 ? (
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
          style={{ maxHeight: Math.min(380, height * 0.45), flexGrow: 0 }}
          getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {query.trim() ? `Nothing matches “${query.trim()}”` : 'Nothing to choose yet'}
            </ThemedText>
          }
          renderItem={({ item }) => {
            const on = values.includes(item.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(item.value)}
                style={({ pressed }) => [
                  styles.option,
                  on && { backgroundColor: Colors.backgroundSelected },
                  pressed && { backgroundColor: Colors.primaryLight },
                ]}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on ? <Icon name="check" size={16} color="#fff" /> : null}
                </View>
                <View style={styles.texts}>
                  <ThemedText
                    style={[styles.text, on && { color: Colors.primaryPressed }]}
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
              </Pressable>
            );
          }}
        />
        <View style={styles.done}>
          <Button
            title={values.length ? `Done (${values.length} selected)` : 'Done'}
            onPress={close}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.page,
  },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingLeft: Spacing.two + 2,
    paddingRight: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.tile,
  },
  chipText: { fontFamily: FontFamily.medium, fontSize: 14, color: Colors.primaryPressed },
  placeholder: { fontSize: 16, color: '#9A9696', paddingVertical: 4 },
  disabled: { backgroundColor: '#EEF2F2', opacity: 0.8 },
  below: { marginTop: 6, marginLeft: 2 },
  search: { marginBottom: Spacing.two },
  option: {
    height: ROW,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  texts: { flex: 1, minWidth: 0 },
  text: { fontFamily: FontFamily.medium, fontSize: 15 },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
  done: { marginTop: Spacing.three },
});
