import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

/** Message box for form-level errors (and later, info notes). */
export function Banner({ message, tone = 'error' }: { message: string; tone?: 'error' | 'info' }) {
  const error = tone === 'error';
  return (
    <View
      accessibilityRole={error ? 'alert' : undefined}
      style={[
        styles.box,
        { backgroundColor: error ? Colors.errorBackground : Colors.primaryLight },
      ]}
    >
      <ThemedText type="small" themeColor={error ? 'error' : 'text'}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.md, padding: Spacing.three },
});
