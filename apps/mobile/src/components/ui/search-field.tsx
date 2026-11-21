import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Layout, Radius, Spacing } from '@/constants/theme';

/**
 * Search box with a clear ✕ once you type. White for the header band; `filled` (grey with a
 * border) for white surfaces such as a bottom sheet.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  filled,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  filled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View style={[styles.box, filled && styles.filled]}>
      <Icon name="search" size={20} color={Colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9A9696"
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        autoFocus={autoFocus}
        style={styles.input}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={10}
        >
          <Icon name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: Layout.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
  },
  filled: {
    backgroundColor: Colors.page,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md + 2,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.text,
  },
});
