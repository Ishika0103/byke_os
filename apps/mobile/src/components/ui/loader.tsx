import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

/**
 * The one loader for the whole app: a spinner with an optional label.
 * Buttons, lists and `LoaderOverlay` all use it, so loading looks the same everywhere.
 */
export function Loader({
  size = 'small',
  color = Colors.primary,
  label,
  style,
}: {
  size?: 'small' | 'large';
  color?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ActivityIndicator size={size} color={color} />
      {label ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Blocks the screen while something slow runs (upload, import, export), saying what is happening.
 * Taps are ignored until `visible` is false.
 */
export function LoaderOverlay({
  visible,
  label,
  hint,
}: {
  visible: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Loader size="large" />
          <ThemedText style={styles.title}>{label}</ThemedText>
          {hint ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.hint}>
              {hint}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  label: { fontFamily: FontFamily.medium },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
    minWidth: 240,
    maxWidth: 320,
  },
  title: { fontFamily: FontFamily.semiBold, fontSize: 16, textAlign: 'center' },
  hint: { textAlign: 'center' },
});
