import { Stack } from 'expo-router';

import { HotelProvider } from '@/features/hotels';

/**
 * Signed-in area: the tab screens (Home · Users · + · Roles · Profile) and, on top of them,
 * the add / edit screens, which cover the tab bar and have their own back button.
 */
export default function AppLayout() {
  return (
    <HotelProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="users/new" />
        <Stack.Screen name="users/[id]" />
        <Stack.Screen name="roles/index" />
        <Stack.Screen name="roles/new" />
        <Stack.Screen name="roles/[id]" />
        <Stack.Screen name="departments/index" />
        <Stack.Screen name="departments/new" />
        <Stack.Screen name="departments/[id]" />
        <Stack.Screen name="hotels/index" />
        <Stack.Screen name="hotels/new" />
        <Stack.Screen name="hotels/[id]/index" />
        <Stack.Screen name="hotels/[id]/room-types/index" />
        <Stack.Screen name="hotels/[id]/room-types/new" />
        <Stack.Screen name="hotels/[id]/room-types/[typeId]" />
        <Stack.Screen name="hotels/[id]/rooms/index" />
        <Stack.Screen name="hotels/[id]/rooms/new" />
        <Stack.Screen name="hotels/[id]/rooms/bulk" />
        <Stack.Screen name="hotels/[id]/rooms/[roomId]" />
        <Stack.Screen name="tasks/new" />
        <Stack.Screen name="tasks/[id]/index" />
        <Stack.Screen name="tasks/[id]/edit" />
        <Stack.Screen name="consumption/index" />
        <Stack.Screen name="consumption/sync" />
        <Stack.Screen name="consumption/module" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="change-password" />
      </Stack>
    </HotelProvider>
  );
}
