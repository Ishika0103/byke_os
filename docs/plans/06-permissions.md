# Plan 06: Role permissions (named permissions), minimal

> Status: ✅ Approved and built (2026-11-23)
> Plan 01 Part B, simplified. Like b2b-portal's named permissions (`"delete-company"` → button hidden if the role lacks it), but stored on the role in the database so Super Admin can change them in the app, and checked by the API too.

## 1. Decisions

| Question                         | Decision                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Style                            | **Named permissions**, one per action: `add-user`, `edit-hotel`, … A button is shown only if its name is in the role's list |
| Who has permissions at the start | **Only Super Admin** (everything). Every other role starts with **none**                                                    |
| Who sets them                    | **Super Admin only**, in the app: Roles → a role → Permissions                                                              |
| Roles screen and Permissions tab | **Super Admin only** (fixed rule; no `…-role` permissions exist)                                                            |
| Actions                          | view, add, edit, delete. Tasks: `edit-task` also covers start / done / verify for now                                       |
| Stored                           | **In the database, on the role** (`roles.permissions`). No new collection                                                   |

## 2. The permission names (one fixed list in `packages/shared`, used by API and app)

| Module     | Permissions                                                          |
| ---------- | -------------------------------------------------------------------- |
| Users      | `view-user` `add-user` `edit-user` `delete-user`                     |
| Hotels     | `view-hotel` `add-hotel` `edit-hotel` `delete-hotel`                 |
| Room types | `view-room-type` `add-room-type` `edit-room-type` `delete-room-type` |
| Rooms      | `view-room` `add-room` `edit-room` `delete-room`                     |
| Tasks      | `view-task` `add-task` `edit-task` `delete-task`                     |

- `edit-user` also covers reset password and the active / inactive switch. `add-room` also covers bulk add.
- **add / edit / delete need view** of the same module: ticking one switches view on, and the API requires it.
- Super Admin holds the special value `*` (everything), so new permissions reach it automatically.
- A new feature later = add names to the list, no new collection or migration.

## 3. Data

```
roles {
  ...existing fields,
  permissions: [String]     // e.g. ['view-hotel', 'view-room', 'add-room']
}
```

- Validated against the fixed list; unknown names are rejected.
- Migration: Super Admin → `['*']`; every other role → `[]`.
- Super Admin's permissions can't be edited.
- Saving a role's permissions is **one update on one document**, so it can never half-save.

## 4. API

- `authorize('add-hotel')` on every route after `authenticate` (except `/health`, `/auth/*`).
- `authenticate` already loads the user's role; it now also reads `roles.permissions`, so a change applies at once, with no new sign-in and no extra query.
- Hotel scope (Plan 05) still applies on top.
- **Exception:** `GET /hotels` and `GET /hotels/:id` need only a login. They return just the user's own hotels, and every other screen needs a hotel to work in, so a role with only `view-task` still works. `view-hotel` decides whether the Hotels screen shows in Profile and who can see the hotels admin list in the app.
- `GET /roles/options` (names only) needs `view-user`, `add-user` or `edit-user`.
- Only Super Admin can edit, delete, reset the password of, or create a Super Admin user.
- The app re-reads the user (`/auth/me`) when Home is shown and when the app returns to the foreground, so role changes show without signing in again.
- No login → 401; missing permission → 403 ("You don't have permission: add-hotel").
- `GET /auth/me` returns `permissions: [...]` (Super Admin gets `['*']`).
- `PATCH /roles/:id` accepts `permissions`.
- The Roles API (list, create, edit, delete, permissions) is **Super Admin only**. The user form's role picker uses a names-only list for anyone with `add-user` / `edit-user`.
- Nobody except Super Admin can give a user the Super Admin role.

## 5. App

- `usePermission('add-hotel')` and `<Can permission="add-hotel">…</Can>`: render only if the name (or `*`) is in `user.permissions`.
- Profile: **Hotels** and **Users** rows show with `view-hotel` / `view-user`; **Roles** only for Super Admin.
- **Add** buttons need their `add-…`; fields and Save need `edit-…` (otherwise the screen is read-only); Delete needs `delete-…`; the status switch and Reset password need `edit-user`.
- Tab bar and "+" quick-add follow the same names.
- **Role screen → Permissions (Super Admin only):** the names grouped by module as a grid (rows = modules, columns = View / Add / Edit / Delete) with switches and one Save. Super Admin's own role shows "Has every permission".
- No permissions at all: "You don't have access to anything yet. Ask your admin."

## 6. Tests

- Permission matrix: a role with nothing gets 403 on every endpoint; Super Admin gets through.
- `view-hotel` only → can list but not add / edit / delete; add `add-hotel` → can add, with no new sign-in.
- add / edit / delete without view is rejected; unknown permission name rejected.
- Roles API is Super Admin only; Super Admin's permissions can't be edited; nobody else can assign the Super Admin role.
- Migration sets `['*']` and `[]`.

## 7. Not in this plan

Task `act` / `verify` split, per-person grants or blocks with expiry, audit log, per-hotel roles, department filters, Excel import of permissions.
