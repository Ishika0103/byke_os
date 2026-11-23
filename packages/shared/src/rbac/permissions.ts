import { z } from 'zod';

/**
 * Permission catalogue (Plan 06): the one list of permission names, used by the API
 * (`authorize('add-hotel')`) and the app (`usePermission('add-hotel')`).
 * Which role holds which names is stored on the role (`roles.permissions`).
 */

export const PERMISSION_ACTIONS = ['view', 'add', 'edit', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** The modules in the Permissions grid. `noun` is the part after the action, e.g. `add-room-type`. */
export const PERMISSION_MODULES = [
  { key: 'users', label: 'Users', noun: 'user' },
  { key: 'hotels', label: 'Hotels', noun: 'hotel' },
  { key: 'roomTypes', label: 'Room types', noun: 'room-type' },
  { key: 'rooms', label: 'Rooms', noun: 'room' },
  { key: 'tasks', label: 'Tasks', noun: 'task' },
  { key: 'departments', label: 'Departments', noun: 'department' },
] as const;

type Noun = (typeof PERMISSION_MODULES)[number]['noun'];
export type Permission = `${PermissionAction}-${Noun}`;

/** Every permission name, e.g. 'view-user', 'add-user', … */
export const PERMISSIONS: readonly Permission[] = PERMISSION_MODULES.flatMap((m) =>
  PERMISSION_ACTIONS.map((a) => `${a}-${m.noun}` as Permission),
);

/** Held only by Super Admin: everything, including permissions added later. Never assignable. */
export const ALL_PERMISSIONS = '*';

export const permissionName = (action: PermissionAction, noun: Noun): Permission =>
  `${action}-${noun}`;

/** True if the list grants `permission` (directly or through `*`). */
export const hasPermission = (list: readonly string[], permission: Permission): boolean =>
  list.includes(ALL_PERMISSIONS) || list.includes(permission);

const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);

/**
 * A role's permissions as saved: known names only, duplicates removed, and add / edit / delete
 * only together with view of the same module.
 */
export const permissionsSchema = z
  .array(z.string())
  .max(PERMISSIONS.length)
  .superRefine((list, ctx) => {
    const unknown = list.filter((p) => !isPermission(p));
    if (unknown.length) {
      ctx.addIssue({ code: 'custom', message: `Unknown permission: ${unknown.join(', ')}` });
    }
    for (const { noun, label } of PERMISSION_MODULES) {
      const others = (['add', 'edit', 'delete'] as const).some((a) =>
        list.includes(`${a}-${noun}`),
      );
      if (others && !list.includes(`view-${noun}`)) {
        ctx.addIssue({ code: 'custom', message: `${label}: add, edit and delete need view` });
      }
    }
  })
  .transform((list) => [...new Set(list)]);
