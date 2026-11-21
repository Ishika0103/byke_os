import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * App icons: SF Symbols on iOS, Material Symbols on Android and web (via expo-symbols).
 * Add new icons here so every screen uses the same names.
 */
const ICONS = {
  menu: { ios: 'line.3.horizontal', md: 'menu' },
  home: { ios: 'house', md: 'home' },
  users: { ios: 'person.2', md: 'group' },
  roles: { ios: 'checkmark.shield', md: 'verified_user' },
  profile: { ios: 'person.crop.circle', md: 'account_circle' },
  lock: { ios: 'lock', md: 'lock' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', md: 'logout' },
  search: { ios: 'magnifyingglass', md: 'search' },
  add: { ios: 'plus', md: 'add' },
  addMany: { ios: 'plus.square.on.square', md: 'library_add' },
  chevronRight: { ios: 'chevron.right', md: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', md: 'expand_more' },
  delete: { ios: 'trash', md: 'delete' },
  check: { ios: 'checkmark', md: 'check' },
  close: { ios: 'xmark', md: 'close' },
  hotel: { ios: 'building.2', md: 'apartment' },
  back: { ios: 'arrow.left', md: 'arrow_back' },
  key: { ios: 'key', md: 'key' },
  edit: { ios: 'pencil', md: 'edit' },
  warning: { ios: 'exclamationmark.triangle', md: 'warning' },
  tasks: { ios: 'checklist', md: 'checklist' },
  bed: { ios: 'bed.double', md: 'bed' },
  arrivals: { ios: 'arrow.down.left.circle', md: 'login' },
  departures: { ios: 'arrow.up.right.circle', md: 'logout' },
  personAdd: { ios: 'person.badge.plus', md: 'person_add' },
  server: { ios: 'server.rack', md: 'dns' },
  camera: { ios: 'camera', md: 'photo_camera' },
  image: { ios: 'photo', md: 'image' },
  play: { ios: 'play.fill', md: 'play_arrow' },
  block: { ios: 'hand.raised', md: 'block' },
  undo: { ios: 'arrow.uturn.backward', md: 'undo' },
  verified: { ios: 'checkmark.seal', md: 'verified' },
  clock: { ios: 'clock', md: 'schedule' },
} as const satisfies Record<string, { ios: SFSymbol; md: string }>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 24, color = Colors.text, style }: Props) {
  const icon = ICONS[name];
  return (
    <SymbolView
      // Material names are checked against expo-symbols' list; cast keeps this file simple.
      name={{ ios: icon.ios, android: icon.md as never, web: icon.md as never }}
      size={size}
      tintColor={color}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
