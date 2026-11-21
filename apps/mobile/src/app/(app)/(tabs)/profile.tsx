import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CardList } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ListRow } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useHotel } from '@/features/hotels';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { hotel } = useHotel();
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!user) return null;

  return (
    <Screen
      tabs
      header={
        <PageHeader back title="Profile">
          <View style={styles.me}>
            <View style={styles.ring}>
              <Avatar name={user.name} size={76} inverted />
            </View>
            <ThemedText style={styles.name} numberOfLines={1}>
              {user.name}
            </ThemedText>
            <ThemedText type="small" style={styles.muted} numberOfLines={1}>
              {user.email}
            </ThemedText>
            {user.role ? (
              <View style={styles.rolePill}>
                <ThemedText type="caption" style={styles.roleText}>
                  {user.role.name}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </PageHeader>
      }
    >
      <SectionLabel title="Account" />
      <CardList>
        <ListRow
          icon="key"
          title="Change password"
          subtitle="Use a new password to sign in"
          onPress={() => router.push('/change-password')}
        />
        <ListRow
          icon="hotel"
          title="Current hotel"
          subtitle="Change it from the Home screen"
          value={hotel?.name ?? 'None'}
        />
      </CardList>

      <SectionLabel title="Administration" />
      <CardList>
        <ListRow
          icon="hotel"
          title="Hotels"
          subtitle="Properties, locations and timings"
          onPress={() => router.push('/hotels')}
        />
        <ListRow
          icon="users"
          title="Users"
          subtitle="Add people and give them a role"
          onPress={() => router.navigate('/users')}
        />
        <ListRow
          icon="roles"
          title="Roles"
          subtitle="Job roles such as GM or Head of Department"
          onPress={() => router.push('/roles')}
        />
      </CardList>

      <Button
        title="Log out"
        icon="logout"
        variant="danger"
        onPress={() => setConfirmOpen(true)}
        style={styles.logout}
      />

      <ConfirmDialog
        visible={confirmOpen}
        title="Log out?"
        message="You'll need your email and password to sign in again."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmOpen(false);
          logout();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  me: { alignItems: 'center', paddingBottom: Spacing.two },
  ring: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: Colors.onHeaderSurface,
    marginBottom: Spacing.two + 4,
  },
  name: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 30,
    color: Colors.textOnPrimary,
    textAlign: 'center',
  },
  muted: { color: Colors.textOnPrimaryMuted, textAlign: 'center' },
  rolePill: {
    marginTop: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onHeaderSurface,
  },
  roleText: { color: Colors.textOnPrimary, fontFamily: FontFamily.semiBold },
  logout: { marginTop: Spacing.three },
});
