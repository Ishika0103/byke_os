import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Shadow, Spacing } from '@/constants/theme';

/** Centred card for questions that need an answer (confirm delete, reset password). */
export function Dialog({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.card} accessibilityViewIsModal>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 32, 30, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: Colors.background,
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three - 4,
    ...Shadow.raised,
  },
  title: { fontFamily: FontFamily.semiBold, fontSize: 19, lineHeight: 28 },
});
