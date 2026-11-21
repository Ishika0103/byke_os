import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

const TONE = {
  primary: Colors.primary,
  success: '#2EA44F',
  warning: '#F0A020',
  danger: '#E5484D',
  muted: '#B5BFBE',
};

export type TimelineItem = {
  key: string;
  title: string;
  /** e.g. "Today, 2:30 PM" */
  time: string;
  /** Extra lines (a reason, a note, what changed). */
  lines?: string[];
  /** Full image URLs. */
  photos?: string[];
  tone: keyof typeof TONE;
};

/** Generic vertical log: a dot per entry, newest last. Photos open full screen when tapped. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View>
      {items.map((item, i) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: TONE[item.tone] }]} />
            {i < items.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.body}>
            <ThemedText type="smallBold">{item.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.time}
            </ThemedText>
            {item.lines?.map((line, n) => (
              <ThemedText key={n} type="small" style={styles.note}>
                {line}
              </ThemedText>
            ))}
            {item.photos?.length ? (
              <View style={styles.photos}>
                {item.photos.map((url) => (
                  <Pressable
                    key={url}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Open photo"
                    onPress={() => setOpen(url)}
                  >
                    <Image source={{ uri: url }} style={styles.thumb} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ))}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable
          style={styles.viewer}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          onPress={() => setOpen(null)}
        >
          {open ? <Image source={{ uri: open }} style={styles.full} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: '#DDE7E6', marginVertical: 2 },
  body: { flex: 1, paddingBottom: Spacing.three },
  note: {
    marginTop: 6,
    padding: Spacing.two + 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.page,
  },
  photos: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  thumb: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: '#EEF2F2' },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { width: '100%', height: '80%' },
});
