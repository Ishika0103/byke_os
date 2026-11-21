# Plan 01 — Authentication & RBAC

> **Status:** split into two parts (updated 2026-11-20):
>
> - **Part A: Login + Roles CRUD + Users CRUD** → ✅ done 2026-11-20 (API, migrations, seed, 41 tests; app login/home/profile in the Byke theme). Roles/users admin screens in the app are not built yet.
> - **Part B: Permissions** (permission matrix, `authorize()`, hotel scoping) → ⏸️ on hold, permissions and modules not finalised

> 📐 **Exact schemas, validation, auth flows and security:** see [`01a-schemas-validation-security.md`](01a-schemas-validation-security.md). It supersedes the field lists and auth details in the rest of this file.

## 0. Current scope (Part A)

**In scope now:**

| Area                      | What gets built                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base fields               | Shared Mongoose plugin: `isActive`, `isDeleted` (soft delete + default filter), `createdBy`, `updatedBy`, timestamps                                                         |
| **Roles CRUD**            | `roles { name, code }` + common fields, **no `permissions` field yet** (added in Part B)                                                                                     |
| **Users CRUD**            | `users { name, email, roleId, hashPassword }` + common fields                                                                                                                |
| **Login**                 | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/change-password`; stateless JWT access (15 min) + refresh (7 days); bcrypt passwords; login rate limit |
| `authenticate` middleware | Every route except `/health`, `/auth/login` and `/auth/refresh` requires a valid login. **Any logged-in user can do everything** until Part B adds permission checks         |
| **Migrations**            | Versioned migration files (see §0.1): indexes for `roles` / `users`, and the system roles (`SUPER_ADMIN`, `HO`, `GM`, `HOD`, `STAFF`)                                        |
| Seed script               | First Super Admin from `.env` (environment-specific, so a seed, not a migration); optional demo users in development                                                         |
| App                       | Login screen, secure token storage, protected routes, `useAuth()`, logout (clears tokens on the device)                                                                      |
| Tests                     | Auth flow, roles & users CRUD, validation, guards                                                                                                                            |

**Safety rules included now** (they don't depend on permissions):

- A role assigned to any user can't be deleted or deactivated (this also protects `SUPER_ADMIN`).
- Users can't deactivate or delete themselves; the last active Super Admin can't be removed.
- Deactivated or deleted users are blocked on their next request (the user is checked on every request).
- `hashPassword` is never returned by the API; emails are unique (case-insensitive).

### 0.1 Database migrations

MongoDB is schemaless, but the database still changes over time (new indexes, renamed fields, backfills, reference data). These changes must be **versioned, repeatable and run the same way on every machine and server**. Mongoose doesn't do this, so we add a migration runner.

| Item           | Decision (proposed)                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library        | [`umzug`](https://github.com/sequelize/umzug): TypeScript-first, widely used, built-in MongoDB storage. (`migrate-mongo` is the common alternative but is JS-first.) |
| Location       | `apps/api/src/db/migrations/YYYYMMDDHHmm-<description>.ts`, each exporting `up()` and `down()`                                                                       |
| Tracking       | Applied migrations are recorded in a `migrations` collection, so each runs **exactly once** per database                                                             |
| Indexes        | Created by migrations. Mongoose `autoIndex` is **on in development only**, **off in production** (auto-building indexes on a live database can slow it down)         |
| Reference data | Data every environment needs (e.g. system roles) → **migration**. Environment-specific or demo data (first admin, sample users) → **seed**                           |
| When they run  | Locally via `npm run migrate:up`; in deployment **before** the API starts; in CI against the test database                                                           |

**Scripts** (`apps/api`, also available from root):

```
npm run migrate:create -- <name>   create a new timestamped migration file
npm run migrate:up                 apply all pending migrations
npm run migrate:down               roll back the last migration
npm run migrate:status             list applied / pending
npm run seed                       create first Super Admin (+ dev demo data)
```

**Rules:**

- **Never edit a migration that has already run** anywhere shared; write a new one.
- Every migration has a working `down()` (or clearly throws if irreversible, e.g. data deletion).
- Migrations are **idempotent** where possible (`createIndex`, upserts), so a re-run never corrupts data.
- Migrations use the raw MongoDB driver (`db.collection(...)`), **not** Mongoose models. Models change over time, and old migrations must keep working.

**First migrations (Part A):**

1. `…-create-roles-indexes`: unique `code` and `name` (partial on `isDeleted: false`)
2. `…-create-users-indexes`: unique `email` (partial), index on `roleId`
3. `…-seed-system-roles`: upsert `SUPER_ADMIN`, `HO`, `GM`, `HOD`, `STAFF` (by `code`)

**Not in Part A:** `roles.permissions`, `authorize()`, `scope:allHotels`, hotel-user mapping, `<Can>` / `usePermission` in the app, plus §3 and the permission rows of §5–§6 below. Hotels, room types and rooms move to the master-data plan.

**Endpoints (Part A):**

```
POST   /auth/login    POST /auth/refresh    POST /auth/change-password    GET /auth/me
GET    /roles      POST /roles      GET|PATCH|DELETE /roles/:id
GET    /users      POST /users      GET|PATCH|DELETE /users/:id
POST   /users/:id/reset-password    (admin sets a new password)
```

---

The sections below are the **full design**. Part B items are kept for reference until permissions are finalised.

> **Owner:** Byke OS team · **Created:** 2026-11-20 · **Pilot go-live:** 2026-11-23 (Astara)

## 1. Why we need this

Byke OS serves people with very different responsibilities (see `BYKE OS _ Astara Pilot.pdf`):

| Who                                 | What they need in Byke OS                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| **HO (Head Office)**                | See every property's health, exceptions, owners and progress                         |
| **GM / Unit Head**                  | Daily priority list for _their_ property; resolves blockers; accountable for results |
| **HOD** (HK, FO, Accounts, Stores…) | Receives routed work, completes it, records proof                                    |
| **Staff**                           | Acts on assigned work                                                                |
| **Super Admin** (tech)              | Sets up roles, hotels and users                                                      |

So RBAC must answer **two questions on every request**:

1. **Permission:** is this user's role allowed to perform this action? (e.g. `rooms:manage`)
2. **Scope:** is this user allowed to act on **this hotel**? (HO → all hotels; everyone else → only hotels they're mapped to)

Authentication (login) is a prerequisite: we can't authorise someone we haven't identified.

---

## 2. Data model

Your base design, with the **minimum changes** needed for RBAC. Changes are marked 🆕 / ✏️ and explained below.

### Common fields (every collection)

`isActive`, `isDeleted`, `createdAt`, `updatedAt`, 🆕 `createdBy`, 🆕 `updatedBy`

- `isActive: false` → **disabled** (still listed in admin screens; e.g. a disabled user cannot log in).
- `isDeleted: true` → **soft-deleted** (hidden everywhere, kept for history/audit). We never hard-delete.
- 🆕 `createdBy` / `updatedBy` (userId): Byke OS is about accountability ("who did what"), so this is cheap to add now and painful to add later.
- Implemented once as a shared Mongoose plugin, so every model gets it consistently and queries exclude `isDeleted: true` by default.

### `roles`

```
{ _id, name, 🆕 code, 🆕 permissions: [string], 🆕 isSystem, isActive, isDeleted, timestamps }
```

- 🆕 `code`: stable key (`SUPER_ADMIN`, `HO`, `GM`, `HOD`, `STAFF`). `name` is free text for display and can be renamed safely.
- 🆕 `permissions`: list of permission strings (see §3). Editable by Super Admin without a code deploy.
- 🆕 `isSystem`: seeded roles that cannot be deleted (prevents locking everyone out).

### `users`

```
{ _id, name, email, roleId, 🆕 passwordHash, 🆕 lastLoginAt, 🆕 tokenVersion, isActive, isDeleted, timestamps }
```

- 🆕 `passwordHash`: bcrypt hash, never returned by the API (`select: false`).
- 🆕 `tokenVersion`: incremented to force-logout a user (password change, deactivation, role change).
- One **global role per user** (your design). If someone needs to be GM at one hotel and HOD at another, we move the role onto the mapping later (see §9).

### `hotels`

```
{ _id, name, code, isActive, isDeleted, timestamps }
```

No change. `code` unique (e.g. `AST` for Astara).

### `hotelUsers` ✏️ (was `hotel-user-mapping` with `userIds: []`)

```
{ _id, hotelId, userId, isActive, isDeleted, timestamps }     unique(hotelId, userId)
```

**Recommended change:** one document per (hotel, user) pair instead of a `userIds` array.

|                                                                | `userIds: []` array                | One doc per pair ✅                     |
| -------------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| "Which hotels can user X access?" (asked on **every request**) | Scan arrays across all hotels      | Simple indexed lookup                   |
| Disable one user at one hotel                                  | Not possible (flags are per hotel) | Own `isActive` / `isDeleted`            |
| Audit who added whom, and when                                 | Lost                               | `createdBy`, `createdAt` per assignment |
| Grows with a large hotel's staff                               | Unbounded array in one doc         | Small fixed-size docs                   |
| Later: role per hotel, department                              | Hard                               | Add a field                             |

### `roomTypes` ✏️ (naming only)

```
{ _id, hotelId, name, code, noOfRooms, isActive, isDeleted, timestamps }    unique(hotelId, code)
```

- ❓ `noOfRooms` duplicates `count(rooms where roomTypeId = X)` and can drift out of sync. **Recommendation:** treat it as _planned inventory_ (what the hotel should have) and show the actual count from `rooms` next to it. Alternatively drop it and always derive it.

### `rooms`

```
{ _id, hotelId, roomTypeId, roomNumber, isActive, isDeleted, timestamps }    unique(hotelId, roomNumber)
```

- `roomNumber` stored as **string** (handles `"102"`, `"G-01"`, `"102A"`).
- `hotelId` kept (denormalised) for fast hotel-scoped queries; the API validates that the room type belongs to the same hotel.

### Naming & indexes

- Collection names in **camelCase plural**: `roles`, `users`, `hotels`, `hotelUsers`, `roomTypes`, `rooms`.
- Unique indexes are **partial** on `isDeleted: false`, so a soft-deleted `code` / `email` can be reused.

---

## 3. Permissions

**Format:** `resource:action`. Keep it to two actions for now: `read` and `manage` (create/update/delete). Splitting `manage` later is a non-breaking change.

The **catalogue** (the list of valid permissions) lives in code (`packages/shared/src/rbac/permissions.ts`), so the API, the app and the seed script all use the same list and typos are caught by TypeScript. Which role has which permission lives in the **database** (`roles.permissions`).

| Permission                                       | SUPER_ADMIN | HO  |  GM  | HOD  | STAFF |
| ------------------------------------------------ | :---------: | :-: | :--: | :--: | :---: |
| `roles:read`                                     |     ✅      | ✅  |      |      |       |
| `roles:manage`                                   |     ✅      |     |      |      |       |
| `users:read`                                     |     ✅      | ✅  | ✅ ¹ | ✅ ¹ |       |
| `users:manage`                                   |     ✅      | ✅  |      |      |       |
| `hotels:read`                                    |     ✅      | ✅  | ✅ ¹ | ✅ ¹ | ✅ ¹  |
| `hotels:manage`                                  |     ✅      | ✅  |      |      |       |
| `hotelUsers:manage` (assign users to hotels)     |     ✅      | ✅  |      |      |       |
| `roomTypes:read`                                 |     ✅      | ✅  | ✅ ¹ | ✅ ¹ | ✅ ¹  |
| `roomTypes:manage`                               |     ✅      | ✅  | ✅ ¹ |      |       |
| `rooms:read`                                     |     ✅      | ✅  | ✅ ¹ | ✅ ¹ | ✅ ¹  |
| `rooms:manage`                                   |     ✅      | ✅  | ✅ ¹ |      |       |
| `scope:allHotels` (not limited to mapped hotels) |     ✅      | ✅  |      |      |       |

¹ Only for hotels the user is mapped to in `hotelUsers`.

**Rules:**

- Code **never checks role names** (`if role === 'GM'`). It only checks permissions, so roles can be renamed or added without code changes.
- `SUPER_ADMIN` holds the wildcard `*`, so new permissions are included automatically.
- **No privilege escalation:** a user can only create or assign a role whose permissions are a subset of their own (HO cannot make someone Super Admin).
- **No lockout:** system roles can't be deleted; the last active Super Admin can't be disabled; users can't change their own role.

---

## 4. Authentication

| Item             | Decision (proposed)                                                                  |
| ---------------- | ------------------------------------------------------------------------------------ |
| Login            | Email + password                                                                     |
| Password storage | `bcryptjs` hash (pure JS, no native build issues on Windows/CI)                      |
| Tokens           | **Access token** (JWT, 15 min) + **refresh token** (JWT, 7 days)                     |
| Revocation       | `tokenVersion` in the refresh token; bumping it on the user logs them out everywhere |
| First user       | Seed script creates system roles + a Super Admin from `.env`                         |
| New users        | Admin creates the user with an initial password (password reset / OTP later)         |
| Brute force      | Strict rate limit on `/auth/login` (e.g. 10 attempts / 15 min per IP + email)        |

**Token storage in the app:** `expo-secure-store` on Android/iOS (encrypted keychain). On **web**, the pilot keeps the refresh token in browser storage, which is acceptable for an internal pilot. Hardening it to an `httpOnly` cookie is in Phase 6.

---

## 5. API design

### Endpoints

```
POST   /auth/login                  public
POST   /auth/refresh                public (needs refresh token)
POST   /auth/logout                 authenticated
GET    /auth/me                     authenticated → user, role, permissions, hotels

GET|POST              /roles                              roles:read / roles:manage
GET|PATCH|DELETE      /roles/:id

GET|POST              /users                              users:read / users:manage
GET|PATCH|DELETE      /users/:id

GET|POST              /hotels                             hotels:read / hotels:manage
GET|PATCH|DELETE      /hotels/:hotelId

GET|POST              /hotels/:hotelId/users              hotelUsers:manage
DELETE                /hotels/:hotelId/users/:userId

GET|POST              /hotels/:hotelId/room-types         roomTypes:read / roomTypes:manage
GET|PATCH|DELETE      /hotels/:hotelId/room-types/:id

GET|POST              /hotels/:hotelId/rooms              rooms:read / rooms:manage
GET|PATCH|DELETE      /hotels/:hotelId/rooms/:id
```

Hotel-owned data is **nested under `/hotels/:hotelId`**, so hotel scope is checked once, in one place, for every hotel-owned resource we add later (tasks, exceptions, HK forms…).

### Request pipeline

```
request
  → authenticate        verify access token → load user + role + hotelIds
                        → req.auth = { userId, permissions, hotelIds, allHotels }
                        ✗ missing/invalid/expired token, or user inactive/deleted → 401
  → authorize('rooms:manage')
                        ✗ permission missing → 403
  → requireHotelAccess  (only on /hotels/:hotelId/...)
                        ✗ hotel not in user's scope → 404 (don't reveal it exists)
  → validateBody(zod)   ✗ → 400
  → controller → service (list queries are filtered to the user's hotels)
```

- The user and role are loaded **per request** (one small indexed query). Disabling a user or changing a role takes effect **immediately** instead of after the token expires. Add caching later only if needed.
- `GET /users` and `GET /hotels` for non-HO users are **filtered** to their mapped hotels.

### New / changed files (API)

```
apps/api/src/
├── db/plugins/base-fields.plugin.ts     isActive, isDeleted, createdBy/updatedBy, soft-delete filter
├── middlewares/
│   ├── authenticate.ts
│   ├── authorize.ts
│   └── require-hotel-access.ts
├── modules/
│   ├── auth/        (routes, controller, service, tokens.ts, password.ts)
│   ├── roles/       (routes, controller, service, model)
│   ├── users/       ✏️ extended: roleId, passwordHash, scoping
│   ├── hotels/
│   ├── hotel-users/
│   ├── room-types/
│   └── rooms/
└── scripts/seed.ts                      system roles + Super Admin (+ optional demo hotel)

packages/shared/src/
├── rbac/permissions.ts                  PERMISSIONS catalogue + types + default role matrix
└── schemas/                             auth, role, user, hotel, hotel-user, room-type, room (Zod)
```

New env vars: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

New dependencies: `jsonwebtoken`, `bcryptjs` (API); `expo-secure-store` (app, via `npx expo install`).

---

## 6. Frontend (app + web)

```
apps/mobile/src/
├── app/
│   ├── (auth)/login.tsx              public
│   └── (app)/...                     protected: redirect to login when signed out
├── features/
│   ├── auth/
│   │   ├── api/auth.api.ts
│   │   ├── context/auth-provider.tsx session state, /auth/me, login, logout
│   │   ├── hooks/use-auth.ts
│   │   ├── hooks/use-permission.ts   usePermission('rooms:manage') → boolean
│   │   ├── components/can.tsx        <Can permission="rooms:manage">…</Can>
│   │   └── storage/token-storage.ts  SecureStore (native) / storage (web)
│   └── hotels/                       hotel switcher (current hotel for multi-hotel users)
└── lib/api-client.ts                 ✏️ attach access token; on 401 refresh once, then retry
```

- Route protection uses Expo Router's guard API for **SDK 58**. Verify it against the versioned Expo docs before coding (`apps/mobile/AGENTS.md`).
- Hiding buttons with `<Can>` is **UX only**. The API is the real security boundary.
- Admin screens (manage roles/users/hotels/rooms) come in a **later** UI phase. For the pilot, the seed script and API (Postman / Compass) are enough.

---

## 7. Testing

- **Integration tests** (Vitest + Supertest) against a real MongoDB test database (`byke_os_test`; CI runs MongoDB as a GitHub Actions service).
- A **permission-matrix test**: for each role × each endpoint, assert the expected allow/deny (200 vs 403/404). This is the single most valuable RBAC test, because it catches accidental access.
- Unit tests: token creation/verification, password hashing, scope filter, escalation guard.

---

## 8. Phases

| #   | Phase                      | Delivers                                                                                                    | Pilot-critical? |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------- | :-------------: |
| 0   | **Decisions**              | Answers to §10                                                                                              |       ✅        |
| 1   | **Foundation**             | Base-fields plugin, shared permission catalogue + Zod schemas, 6 models with indexes, seed script           |       ✅        |
| 2   | **Authentication**         | login / refresh / logout / me, password hashing, JWT                                                        |       ✅        |
| 3   | **Authorization**          | authenticate + authorize + hotel-scope middleware, applied to all routes, permission-matrix tests           |       ✅        |
| 4   | **Master-data APIs**       | CRUD for roles, users, hotels, hotel-user assignment, room types, rooms                                     |       ✅        |
| 5   | **App integration**        | Login screen, secure token storage, protected routes, `useAuth` / `usePermission` / `<Can>`, hotel switcher |       ✅        |
| 6   | **Hardening** (post-pilot) | Web httpOnly-cookie refresh, password reset, account lockout, audit-log collection, admin UI screens        |                 |

Each phase ends with lint + typecheck + tests green, and is reviewed before the next one starts.

---

## 9. Deliberately _not_ in scope (add when needed)

- Role per hotel (role on `hotelUsers` instead of on `users`)
- **Departments** (HK, FO, F&B, Stores, Accounts…) for routing work to the right HOD. These will be needed for the task/exception engine, so planned as the next module after RBAC.
- Field-level permissions, ABAC/policy engines, SSO, multi-factor auth

---

## 10. Decisions

| #   | Question                                                                           | Status                                       |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Login method: email + password, or phone + OTP?                                    | ✅ **Email + password** (decided 2026-11-20) |
| 6   | Add `createdBy` / `updatedBy` to all collections?                                  | ✅ **Yes** (decided 2026-11-20)              |
| 3   | Confirm roles: `SUPER_ADMIN`, `HO`, `GM`, `HOD`, `STAFF`?                          | ✅ Seeded by migration (user approved)       |
| 7   | One global role per user (your current design)?                                    | ❓ Open (recommended: yes, for now)          |
| 2   | Change `hotel-user-mapping.userIds[]` to one doc per (hotel, user) → `hotelUsers`? | ⏸️ Part B / master data                      |
| 4   | Permission matrix in §3, e.g. can a **GM** manage users for their own hotel?       | ⏸️ Part B                                    |
| 5   | `roomTypes.noOfRooms`: keep as planned inventory, or derive from `rooms`?          | ⏸️ Master-data plan                          |
