import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { OptionDialog, type Option } from '@/components/ui/option-dialog';
import { Colors, FontFamily, Layout, Radius, Spacing } from '@/constants/theme';

/**
 * Labelled field that opens a bottom sheet to pick one option (e.g. a role). `searchable` adds
 * a search box to the sheet for long lists (e.g. cities).
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  error,
  hint,
  disabled,
  searchable,
  searchPlaceholder,
}: {
  label: string;
  value: string | null;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  // e.g. "Bengaluru, Karnataka" when the option has a second line.
  const shown = selected
    ? `${selected.label}${selected.description ? `, ${selected.description}` : ''}`
    : null;

  return (
    <View>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown ?? placeholder}`}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { borderColor: error ? Colors.error : Colors.border },
          disabled && styles.disabled,
        ]}
      >
        <ThemedText
          style={[styles.value, { color: selected ? Colors.text : '#9A9696' }]}
          numberOfLines={1}
        >
          {shown ?? placeholder}
        </ThemedText>
        <Icon name="chevronDown" size={20} color={Colors.textSecondary} />
      </Pressable>
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

      <OptionDialog
        visible={open}
        title={label}
        options={options}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
      />
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
    height: Layout.controlHeight,
    borderWidth: 1,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.page,
  },
  value: { flex: 1, fontSize: 16 },
  disabled: { backgroundColor: '#EEF2F2', opacity: 0.8 },
  below: { marginTop: 6, marginLeft: 2 },
});
