import { useEffect, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { MobileFrameWidth } from '@/components/mobile-frame';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

const CLOSE_DISTANCE = 80;
/** Lifts the sheet above the keyboard on iOS (searchable dropdowns). Android resizes on its own. */
const Lift = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
const OFFSCREEN = 800;

/**
 * Panel at the bottom of the screen, shown instantly with no animation (all dropdowns, Quick add). Close it by tapping
 * outside, pressing back, or dragging the handle down. On web it stays as wide as the phone frame.
 */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Opens in place, no slide-in. Reset after a drag-to-close.
      translateY.set(0);
    }
  }, [visible, translateY]);

  const drag = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      translateY.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > 900) {
        translateY.set(withTiming(OFFSCREEN, { duration: 180 }, () => scheduleOnRN(onClose)));
      } else {
        translateY.set(withTiming(0, { duration: 150 }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* Modals render outside the app's root view, so gestures need their own root. */}
      <GestureHandlerRootView style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Lift behavior="padding" style={styles.lift}>
          <Animated.View
            style={[
              styles.sheet,
              // Measured from the window: a % max height doesn't work inside the keyboard wrapper.
              { paddingBottom: insets.bottom + Spacing.three, maxHeight: height * 0.85 },
              sheetStyle,
            ]}
            accessibilityViewIsModal
          >
            <GestureDetector gesture={drag}>
              <View style={styles.grab}>
                <View style={styles.handle} />
                {title ? <ThemedText style={styles.title}>{title}</ThemedText> : null}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </Lift>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 32, 30, 0.5)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  lift: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MobileFrameWidth,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.three,
  },
  grab: { paddingTop: Spacing.three - 4, paddingBottom: Spacing.two, gap: Spacing.three },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9D6D4',
  },
  title: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    lineHeight: 28,
    paddingHorizontal: Spacing.two,
  },
});
