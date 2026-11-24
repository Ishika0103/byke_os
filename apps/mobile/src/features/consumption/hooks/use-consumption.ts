import { useCallback, useEffect, useState } from 'react';
import type { ConsumptionModule, ConsumptionSummary } from '@byke-os/shared';

import { errorMessage } from '@/lib/form-errors';
import { consumptionApi } from '../api/consumption.api';
import { addDays, todayIso } from '../dates';

/** One day for every property, laid out like the sheet. `reload` refetches (pull-to-refresh). */
export function useConsumptionSummary(date: string, refreshKey = 0) {
  const [summary, setSummary] = useState<ConsumptionSummary | null>(null);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await consumptionApi.summary(date));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    consumptionApi
      .summary(date)
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoadedDate(date));
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  return { summary, loading: loadedDate !== date, error, reload: load };
}

/** One module's marks for one property between two days: { 'YYYY-MM-DD': 0 | 1 }. */
export function useConsumptionRange(
  hotelId: string | undefined,
  module: string,
  from: string,
  to: string,
) {
  const [marks, setMarks] = useState<Record<string, 0 | 1>>({});
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const want = `${hotelId}|${module}|${from}|${to}`;

  const fetchMarks = useCallback(async () => {
    const page = await consumptionApi.list({ hotelId, module, from, to, limit: 100 });
    const next: Record<string, 0 | 1> = {};
    for (const c of page.items) next[c.date.slice(0, 10)] = c.isMarked;
    return next;
  }, [hotelId, module, from, to]);

  const reload = useCallback(async () => {
    try {
      setMarks(await fetchMarks());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [fetchMarks]);

  useEffect(() => {
    if (!hotelId) return;
    let cancelled = false;
    fetchMarks()
      .then((next) => {
        if (cancelled) return;
        setMarks(next);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setKey(want));
    return () => {
      cancelled = true;
    };
  }, [fetchMarks, hotelId, want]);

  return { marks, loading: !!hotelId && key !== want, error, reload };
}

/** The six modules, in sheet order. */
export function useConsumptionModules() {
  const [modules, setModules] = useState<ConsumptionModule[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consumptionApi
      .modules()
      .then((data) => !cancelled && setModules(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  return { modules, error };
}

/** The last 7 days (ending today) for one hotel: per module, days marked out of days with data. */
export function useConsumptionWeek(hotelId: string, refreshKey = 0) {
  const [week, setWeek] = useState<Record<string, { marked: number; days: number }> | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const want = `${hotelId}|${refreshKey}`;

  useEffect(() => {
    let cancelled = false;
    const to = todayIso();
    consumptionApi
      .list({ hotelId, from: addDays(to, -6), to, limit: 100 })
      .then((page) => {
        if (cancelled) return;
        const next: Record<string, { marked: number; days: number }> = {};
        for (const c of page.items) {
          const m = (next[c.module] ??= { marked: 0, days: 0 });
          m.days += 1;
          m.marked += c.isMarked;
        }
        setWeek(next);
      })
      .catch(() => !cancelled && setWeek({}))
      .finally(() => !cancelled && setLoadedFor(want));
    return () => {
      cancelled = true;
    };
  }, [hotelId, want]);

  return { week, loading: loadedFor !== want };
}
