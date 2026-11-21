import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import type { DepartmentKey, TaskDetail, TaskSummary, TaskView } from '@byke-os/shared';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePagedList } from '@/hooks/use-paged-list';
import { errorMessage } from '@/lib/form-errors';
import { tasksApi } from '../api/tasks.api';

export type TaskFilters = {
  view: TaskView;
  mine: boolean;
  department: DepartmentKey | null;
  search: string;
};

/** Tasks screen list for one hotel. */
export function useTaskList(hotelId: string, filters: TaskFilters) {
  const q = useDebouncedValue(filters.search.trim());
  const { view, mine, department } = filters;
  const fetchPage = useCallback(
    (page: number) =>
      tasksApi.list(hotelId, {
        page,
        limit: 30,
        view,
        q,
        ...(mine && { assigneeId: 'me' }),
        ...(department && { department }),
      }),
    [hotelId, view, mine, department, q],
  );
  return usePagedList(fetchPage);
}

/** One task with its timeline; reloads whenever the screen comes back into view (after an edit). */
export function useTaskDetail(hotelId: string, id: string) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    let cancelled = false;
    setError(null);
    tasksApi
      .get(hotelId, id)
      .then((data) => {
        if (cancelled) return;
        setTask(data);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [hotelId, id]);

  useFocusEffect(load);

  return { task, setTask, error, retry: load };
}

/** Counts for Home; reloads on focus. */
export function useTaskSummary(hotelId: string | null | undefined) {
  const [summary, setSummary] = useState<TaskSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!hotelId) return setSummary(null);
      let cancelled = false;
      tasksApi
        .summary(hotelId)
        .then((s) => !cancelled && setSummary(s))
        .catch(() => !cancelled && setSummary(null));
      return () => {
        cancelled = true;
      };
    }, [hotelId]),
  );

  return summary;
}

/** Re-renders every minute so "Due in 25 min" stays current. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
