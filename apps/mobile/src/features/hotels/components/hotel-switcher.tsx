import { formatLocation } from '@byke-os/shared';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { OptionDialog } from '@/components/ui/option-dialog';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useHotel } from '../context/hotel-provider';

/** Hotel picker for the Home header band. Changing it changes every hotel-owned screen. */
export function HotelSwitcher() {
  const { hotels, hotel, loading, selectHotel } = useHotel();
  const [open, setOpen] = useState(false);
  const label = hotel?.name ?? (loading ? 'Loading…' : 'No hotel');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hotel: ${label}. Change hotel`}
        onPress={() => setOpen(true)}
        disabled={hotels.length === 0}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.75 }]}
      >
        <Icon name="hotel" size={18} color={Colors.textOnPrimary} />
        <ThemedText style={styles.label} numberOfLines={1}>
          {label}
        </ThemedText>
        {hotels.length > 0 ? (
          <Icon name="chevronDown" size={18} color={Colors.textOnPrimary} />
        ) : null}
      </Pressable>

      <OptionDialog
        visible={open}
        title="Select hotel"
        options={hotels.map((h) => ({
          value: h.id,
          label: h.name,
          description: formatLocation(h.location),
        }))}
        value={hotel?.id ?? null}
        onSelect={selectHotel}
        onClose={() => setOpen(false)}
        searchable={hotels.length > 6}
        searchPlaceholder="Search hotels"
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    maxWidth: 240,
    paddingHorizontal: Spacing.three - 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onHeaderSurface,
  },
  label: {
    flexShrink: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textOnPrimary,
  },
});
