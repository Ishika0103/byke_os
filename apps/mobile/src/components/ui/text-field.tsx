import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Layout, Radius, Spacing } from '@/constants/theme';

/** Instance type of TextInput (focus(), blur()…). */
export type TextInputHandle = ComponentRef<typeof TextInput>;

type Props = TextInputProps & {
  label: string;
  error?: string;
  /** Grey help text under the field (hidden while there's an error). */
  hint?: string;
  /** Something inside the field on the right, e.g. a Show/Hide toggle. */
  right?: ReactNode;
  ref?: Ref<TextInputHandle>;
};

/** Small grey label above a filled 52px input; teal border when focused, red with an error. */
export function TextField({
  label,
  error,
  hint,
  right,
  style,
  editable = true,
  onFocus,
  onBlur,
  ref,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? Colors.error : focused ? Colors.primary : Colors.border;

  return (
    <View>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View
        style={[
          styles.box,
          { borderColor, backgroundColor: focused ? Colors.background : Colors.page },
          !editable && styles.readOnly,
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor="#9A9696"
          editable={editable}
          style={[styles.input, !editable && { color: Colors.textSecondary }, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {right}
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
  box: {
    height: Layout.controlHeight,
    borderWidth: 1,
    borderRadius: Radius.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
  },
  readOnly: { backgroundColor: '#EEF2F2' },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.text,
  },
  below: { marginTop: 6, marginLeft: 2 },
});
