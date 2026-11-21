import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { LoginForm } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';

/** How far the white card overlaps the green header. */
const CARD_OVERLAP = 56;

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.backgroundElement }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* White status-bar icons on the green header */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.four }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Green header: grows with its content, so nothing ever sits on its edge */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.primary,
              paddingTop: insets.top + Spacing.six,
              paddingBottom: CARD_OVERLAP + Spacing.five,
            },
          ]}
        >
          <BrandMark inverted size="lg" />
          <ThemedText type="small" themeColor="textOnPrimaryMuted">
            Run every property the Byke way.
          </ThemedText>
        </View>

        <View style={styles.body}>
          <View
            style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <ThemedText type="subtitle">Sign in</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Use the email and password provided by your administrator.
            </ThemedText>
            <LoginForm />
          </View>

          <ThemedText type="caption" themeColor="textSecondary" style={styles.footer}>
            Byke OS · © {new Date().getFullYear()}
          </ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  body: {
    marginTop: -CARD_OVERLAP,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  subtitle: { marginBottom: Spacing.three },
  footer: { textAlign: 'center' },
});
