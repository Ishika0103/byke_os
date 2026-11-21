import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/app-tab-bar';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Screen scaffold: PageHeader band on top, scrollable content on the page background, and an
 * optional pinned `footer` (e.g. Save). `tabs` leaves room for the bottom tab bar.
 */
export function Screen({
  header,
  children,
  footer,
  tabs,
  onRefresh,
  refreshing = false,
}: {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tabs?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const bottom = tabs ? tabSpace : footer ? Spacing.four : insets.bottom + Spacing.five;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          ) : undefined
        }
      >
        <View style={styles.inner}>{children}</View>
      </ScrollView>
      {footer ? <FooterBar>{footer}</FooterBar> : null}
    </KeyboardAvoidingView>
  );
}

/** Pinned bar at the bottom of a screen for its main action(s). */
export function FooterBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
      <View style={styles.footerInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.page },
  scroll: { flex: 1 },
  content: { padding: Spacing.three, flexGrow: 1 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
  footer: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.three - 4,
    paddingHorizontal: Spacing.three,
  },
  footerInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: 10 },
});
