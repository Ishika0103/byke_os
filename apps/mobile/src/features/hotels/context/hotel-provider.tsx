import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Hotel } from '@byke-os/shared';

import { errorMessage } from '@/lib/form-errors';
import { hotelsApi } from '../api/hotels.api';

type HotelContextValue = {
  /** Active hotels, for the Home picker. */
  hotels: Hotel[];
  /** The hotel being worked on; null while loading or when there are no hotels. */
  hotel: Hotel | null;
  loading: boolean;
  error: string | null;
  selectHotel: (id: string) => void;
  /** Reload after adding / editing / deactivating / deleting a hotel. */
  reloadHotels: () => void;
};

const HotelContext = createContext<HotelContextValue | null>(null);

/**
 * The hotel the signed-in user is working on. Every hotel-owned screen reads it.
 * The choice is kept in memory only (Plan 02 §5): after a restart it's the first hotel again.
 */
export function HotelProvider({ children }: { children: ReactNode }) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    hotelsApi
      .list({ isActive: true, limit: 100 })
      .then((data) => {
        if (cancelled) return;
        setHotels(data.items);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reloadHotels = useCallback(() => setAttempt((n) => n + 1), []);
  // Keep the chosen hotel while it's still active; otherwise fall back to the first one.
  const hotel = hotels.find((h) => h.id === hotelId) ?? hotels[0] ?? null;

  return (
    <HotelContext.Provider
      value={{ hotels, hotel, loading, error, selectHotel: setHotelId, reloadHotels }}
    >
      {children}
    </HotelContext.Provider>
  );
}

export function useHotel() {
  const value = useContext(HotelContext);
  if (!value) throw new Error('useHotel must be used inside <HotelProvider>');
  return value;
}
