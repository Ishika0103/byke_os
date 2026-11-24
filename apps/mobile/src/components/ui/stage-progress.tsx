import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily } from '@/constants/theme';

const TONE = {
  danger: { color: '#E5484D', text: Colors.error },
};

/**
 * Generic progress bar for anything that moves through steps (tasks now, other records later).
 * Steps up to `current` are filled; `flag` marks the current step as Cancelled.
 */
export function StageProgress({
  steps,
  current,
  flag,
}: {
  steps: string[];
  /** Index of the last step reached. */
  current: number;
  flag?: { label: string; tone: keyof typeof TONE };
}) {
  const flagTone = flag ? TONE[flag.tone] : null;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${steps[current]}${flag ? `, ${flag.label}` : ''}, step ${current + 1} of ${steps.length}`}
    >
      <View style={styles.track}>
        {steps.map((step, i) => {
          const reached = i <= current;
          const isCurrent = i === current;
          const color = isCurrent && flagTone ? flagTone.color : Colors.primary;
          return (
            <Fragment key={step}>
              {i > 0 ? (
                <View style={[styles.line, i <= current && { backgroundColor: Colors.primary }]} />
              ) : null}
              <View
                style={[
                  styles.dot,
                  reached && { backgroundColor: color, borderColor: color },
                  isCurrent && styles.currentDot,
                  isCurrent && { shadowColor: color },
                ]}
              >
                {reached && !isCurrent ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                {isCurrent && flag ? <Icon name="close" size={13} color="#FFFFFF" /> : null}
                {isCurrent && !flag ? <View style={styles.inner} /> : null}
              </View>
            </Fragment>
          );
        })}
      </View>
      <View style={styles.labels}>
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <Text
              key={step}
              numberOfLines={2}
              style={[
                styles.label,
                i === 0 && styles.first,
                i === steps.length - 1 && styles.last,
                i <= current && styles.reached,
                isCurrent && styles.current,
                isCurrent && flagTone && { color: flagTone.text },
              ]}
            >
              {isCurrent && flag ? flag.label : step}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  line: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#DDE7E6' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: '#CBD5D4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  inner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  labels: { flexDirection: 'row', marginTop: 8 },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: '#8C9493',
  },
  first: { textAlign: 'left' },
  last: { textAlign: 'right' },
  reached: { color: Colors.textSecondary },
  current: { fontFamily: FontFamily.semiBold, color: Colors.primaryPressed },
});
