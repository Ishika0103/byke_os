import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Loader } from '@/components/ui/loader';
import { Colors, FontFamily, Layout, Radius, Spacing } from '@/constants/theme';

/**
 * primary = filled teal · secondary = white with teal border · soft = light teal, quiet action
 * danger = soft red (delete, log out) · ghost = text only
 */
export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost';

const LOOK: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: Colors.primary, pressed: Colors.primaryPressed, fg: Colors.textOnPrimary },
  secondary: {
    bg: Colors.background,
    pressed: Colors.primaryLight,
    fg: Colors.primaryPressed,
    border: Colors.primary,
  },
  soft: { bg: Colors.tile, pressed: Colors.backgroundSelected, fg: Colors.primaryPressed },
  danger: { bg: Colors.errorBackground, pressed: '#F9D9D9', fg: Colors.error },
  ghost: { bg: 'transparent', pressed: Colors.primaryLight, fg: Colors.textSecondary },
};

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  /** Smaller button (44 high), e.g. inside dialogs. */
  compact?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  icon,
  loading,
  compact,
  disabled,
  style,
  ...rest
}: Props) {
  const look = LOOK[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          height: compact ? 46 : Layout.buttonHeight,
          backgroundColor: state.pressed ? look.pressed : look.bg,
        },
        look.border && { borderWidth: 1.5, borderColor: look.border },
        state.pressed && { transform: [{ scale: 0.98 }] },
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <Loader color={look.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={look.fg} /> : null}
          <ThemedText style={[styles.label, { color: look.fg }]} numberOfLines={1}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.two + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: FontFamily.semiBold, fontSize: 16, lineHeight: 24 },
  disabled: { opacity: 0.55 },
});
