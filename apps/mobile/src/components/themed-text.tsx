import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'small'
    | 'smallBold'
    | 'caption'
    | 'link'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = type === 'link' && !themeColor ? theme.primary : theme[themeColor ?? 'text'];

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 24 },
  title: { fontFamily: FontFamily.semiBold, fontSize: 30, lineHeight: 42 },
  subtitle: { fontFamily: FontFamily.semiBold, fontSize: 22, lineHeight: 32 },
  heading: { fontFamily: FontFamily.medium, fontSize: 18, lineHeight: 28 },
  small: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 20 },
  smallBold: { fontFamily: FontFamily.semiBold, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 18 },
  link: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 22 },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
});
