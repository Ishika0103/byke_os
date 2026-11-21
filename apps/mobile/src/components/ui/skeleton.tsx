import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CardList } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

/** Grey pulsing placeholder shown while data loads. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 7,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: '#E3ECEB' }, style]}
    />
  );
}

/** A card of placeholder list rows, the same shape as the real rows. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <CardList>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={44} height={44} radius={13} />
          <View style={styles.text}>
            <Skeleton width="55%" height={15} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ))}
    </CardList>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    paddingHorizontal: Spacing.three + 2,
    minHeight: 72,
  },
  text: { flex: 1, gap: Spacing.two },
});
