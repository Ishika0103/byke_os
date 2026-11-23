import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Wraps form fields: when `locked` they are shown dimmed and can't be changed (no edit permission). */
export function ReadOnly({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <View
      pointerEvents="none"
      style={{ opacity: 0.7, gap: 16 }}
      accessibilityState={{ disabled: true }}
    >
      {children}
    </View>
  );
}
