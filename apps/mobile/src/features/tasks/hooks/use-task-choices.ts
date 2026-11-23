import { useEffect, useState } from 'react';
import { SUPER_ADMIN_ROLE_CODE, type TaskMaster } from '@byke-os/shared';

import type { Option } from '@/components/ui/option-dialog';
import { roomsApi } from '@/features/rooms';
import { usersApi } from '@/features/users';
import { tasksApi } from '../api/tasks.api';

/** Active departments as picker options (name; code as the second line). */
export function useDepartmentChoices(): Option[] {
  const [departments, setDepartments] = useState<Option[]>([]);
  useEffect(() => {
    let cancelled = false;
    tasksApi
      .departments()
      .then((p) => {
        if (!cancelled) setDepartments(p.items.map((d) => ({ value: d.id, label: d.name })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return departments;
}

/** Everything the task form lets you pick from: titles, departments, rooms and people. */
export function useTaskChoices(hotelId: string) {
  const departments = useDepartmentChoices();
  const [masters, setMasters] = useState<TaskMaster[]>([]);
  const [rooms, setRooms] = useState<Option[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  useEffect(() => {
    let cancelled = false;
    tasksApi
      .masters()
      .then((m) => !cancelled && setMasters(m))
      .catch(() => {});
    roomsApi
      .list(hotelId, { limit: 300, isActive: true })
      .then((p) => {
        if (cancelled) return;
        setRooms(
          p.items.map((r) => ({
            value: r.id,
            label: `Room ${r.roomNumber}`,
            description: r.roomType?.name,
          })),
        );
      })
      .catch(() => {});
    usersApi
      .list({ limit: 100, isActive: true })
      .then((p) => {
        if (cancelled) return;
        // Only people at this hotel, plus Super Admins (they work everywhere). Plan 05.
        const here = p.items.filter(
          (u) => u.role?.code === SUPER_ADMIN_ROLE_CODE || u.hotels.some((h) => h.id === hotelId),
        );
        setPeople(here.map((u) => ({ value: u.id, label: u.name, description: u.email })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hotelId]);
  return { masters, departments, rooms, people };
}
