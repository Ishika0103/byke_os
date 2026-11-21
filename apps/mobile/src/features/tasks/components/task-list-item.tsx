import type { Task } from '@byke-os/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Colors, Spacing } from '@/constants/theme';
import { dueText, taskSubtitle } from '../utils/format';
import { StagePill } from './stage-pill';

/** Title, "Room 101 · Housekeeping · Ravi", stage pill and due time (red when late). */
export function TaskListItem({
  task,
  now,
  onPress,
}: {
  task: Task;
  now: Date;
  onPress: () => void;
}) {
  const due = dueText(task, now);
  const subtitle = taskSubtitle(task);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${subtitle}, ${due.text}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.page }]}
    >
      <View style={[styles.bar, due.late && { backgroundColor: Colors.error }]} />
      <View style={styles.text}>
        <ThemedText type="smallBold" style={styles.title} numberOfLines={2}>
          {task.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
        <View style={styles.meta}>
          <StagePill stage={task.stage} />
          <View style={styles.due}>
            <Icon name="clock" size={14} color={due.late ? Colors.error : Colors.textSecondary} />
            <ThemedText
              type="small"
              numberOfLines={1}
              style={{ color: due.late ? Colors.error : Colors.textSecondary }}
            >
              {due.text}
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    paddingVertical: Spacing.three - 2,
    paddingRight: Spacing.three,
    paddingLeft: Spacing.three - 4,
  },
  bar: { width: 4, borderRadius: 2, backgroundColor: 'transparent' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 22 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: 6 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
});
