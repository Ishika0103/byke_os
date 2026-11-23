import { useEffect, useState } from 'react';
import type { Location } from '@byke-os/shared';

import { locationsApi } from '../api/locations.api';

/** All locations, for the hotel form's dropdown. */
export function useLocationOptions() {
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    let cancelled = false;
    locationsApi
      .list()
      .then((data) => !cancelled && setLocations(data.items))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return locations;
}
