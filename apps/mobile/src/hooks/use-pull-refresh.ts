import { useCallback, useState } from 'react';

/** For `<Screen onRefresh refreshing>`: runs `reload` on pull-down and shows the spinner meanwhile. */
export function usePullRefresh(reload: () => Promise<unknown> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch {
      // The screen shows its own error state; the spinner just stops.
    } finally {
      setRefreshing(false);
    }
  }, [reload]);
  return { refreshing, onRefresh };
}
