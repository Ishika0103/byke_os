import type { TaskStage } from '@byke-os/shared';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { STAGE_LABEL, STAGE_LOOK } from '../utils/format';

/** "● In progress" etc., coloured per stage. */
export function StagePill({ stage }: { stage: TaskStage }) {
  const look = STAGE_LOOK[stage];
  return (
    <View style={[styles.pill, { backgroundColor: look.bg }]}>
      <View style={[styles.dot, { backgroundColor: look.dot }]} />
      <Text style={[styles.text, { color: look.fg }]} numberOfLines={1}>
        {STAGE_LABEL[stage]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 10,
    height: 26,
    borderRadius: Radius.pill,
    flexShrink: 0,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: FontFamily.semiBold, fontSize: 12, lineHeight: 18 },
});
