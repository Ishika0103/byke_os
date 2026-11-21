import { useEffect, useState } from 'react';
import { healthApi, type HealthData } from '../api/health.api';

export type ApiStatus = 'checking' | 'online' | 'offline';

/** Pings the API health endpoint once on mount. */
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [database, setDatabase] = useState<HealthData['database'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    healthApi
      .check()
      .then((data) => {
        if (cancelled) return;
        setStatus('online');
        setDatabase(data.database);
      })
      .catch(() => !cancelled && setStatus('offline'));
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, database };
}
