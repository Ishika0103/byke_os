# Database schema (MongoDB `byke_os`)

Current state after Plan 06. The code is the source of truth (`apps/api/src/modules/*/*.model.ts`, `apps/api/src/db/migrations/`); update this file whenever a migration changes a collection.

## Fields on every business collection

| Field                     | Type             | Meaning                                                       |
| ------------------------- | ---------------- | ------------------------------------------------------------- |
| `_id`                     | ObjectId         | exposed by the API as `id`                                    |
| `isActive`                | Boolean          | `false` = disabled but visible to admins                      |
| `isDeleted`               | Boolean          | `true` = soft-deleted, hidden everywhere (never hard-deleted) |
| `createdBy` / `updatedBy` | ObjectId → users | who created / last changed it                                 |
| `createdAt` / `updatedAt` | Date             | set automatically                                             |

## Relations

```
roles 1───* users *───* hotels
                          │ 1
                          ├──* roomTypes 1───* rooms
                          └──* tasks 1───* taskUpdates
tasks ──(optional)── rooms,  tasks ──(optional)── users (assignee)
```

## roles

| Field         | Type     | Notes                                                                                                      |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `name`        | String   | 2–50 chars, unique ignoring case                                                                           |
| `code`        | String   | UPPERCASE, unique, never changes (`SUPER_ADMIN`, `HO`, `GM`, `HOD`, `STAFF`)                               |
| `permissions` | [String] | named permissions, e.g. `view-hotel`, `add-room`; Super Admin = `['*']`; other roles start empty (Plan 06) |

Indexes: `code` unique, `name` unique case-insensitive (both partial on `isDeleted:false`).

## users

| Field          | Type                | Notes                                                     |
| -------------- | ------------------- | --------------------------------------------------------- |
| `name`         | String              | 2–80 chars                                                |
| `email`        | String              | lowercase, unique                                         |
| `roleId`       | ObjectId → roles    | one role per user                                         |
| `hotelIds`     | [ObjectId → hotels] | hotels the user works at; empty for Super Admin (Plan 05) |
| `hashPassword` | String              | bcrypt hash, never returned by the API                    |

Indexes: `email` unique (partial), `roleId`, `hotelIds`.

## hotels

| Field                         | Type     | Notes                                                               |
| ----------------------------- | -------- | ------------------------------------------------------------------- |
| `name`                        | String   | 2–100 chars, unique ignoring case                                   |
| `code`                        | String   | generated from the name (e.g. `AST`), unique, never changes         |
| `locationId`                  | ObjectId | → `locations._id` (the API returns `location: { id, name, state }`) |
| `checkInTime`, `checkOutTime` | String   | `HH:mm`                                                             |

Indexes: `code` unique, `name` unique case-insensitive (both partial), `locationId`.

## locations

Filled by migration (21 Byke locations, plus any city an existing hotel used). Read-only through the API for now; no screens.

| Field    | Type          | Notes                                                           |
| -------- | ------------- | --------------------------------------------------------------- |
| `name`   | String        | 2–60 chars, unique ignoring case (e.g. `Matheran`, `North Goa`) |
| `state`  | String        | e.g. `Maharashtra`                                              |
| `slug`   | String        | e.g. `north-goa`, unique                                        |
| `bykeId` | Number / null | Byke's own location id (North and South Goa both use 28)        |

Indexes: `name` unique case-insensitive, `slug` unique (both partial).

## roomTypes

| Field             | Type              | Notes                                      |
| ----------------- | ----------------- | ------------------------------------------ |
| `hotelId`         | ObjectId → hotels | never changes                              |
| `name`            | String            | 2–50 chars, unique per hotel               |
| `code`            | String            | generated, unique per hotel, never changes |
| `pmsCode`         | String \| null    | code used in the PMS                       |
| `cleaningMinutes` | Number \| null    | 5–240                                      |

Room count is not stored; it is counted from `rooms`.
Indexes: `{hotelId, code}` unique, `{hotelId, name}` unique case-insensitive (both partial).

## rooms

| Field        | Type                 | Notes                            |
| ------------ | -------------------- | -------------------------------- |
| `hotelId`    | ObjectId → hotels    | never changes                    |
| `roomTypeId` | ObjectId → roomTypes |                                  |
| `roomNumber` | String               | up to 10 chars, unique per hotel |
| `floor`      | Number \| null       | -5 to 200                        |
| `isSellable` | Boolean              | default true                     |
| `notes`      | String \| null       | up to 500 chars                  |

Indexes: `{hotelId, roomNumber}` unique (partial), `roomTypeId`, `{hotelId, floor}`.

## tasks (current state of a task)

| Field                          | Type                           | Notes                                                                        |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------- |
| `hotelId`                      | ObjectId → hotels              | never changes                                                                |
| `title`                        | String                         | 3–120 chars                                                                  |
| `description`                  | String \| null                 | up to 1000 chars                                                             |
| `department`                   | String                         | `housekeeping` \| `front_office` \| `maintenance`                            |
| `roomId`                       | ObjectId \| null               | optional room                                                                |
| `assigneeId`                   | ObjectId \| null               | user; must work at the hotel                                                 |
| `dueAt`                        | Date                           |                                                                              |
| `stage`                        | String                         | `pending` → `in_progress` → `done` → `verified`; also `blocked`, `cancelled` |
| `blockedFrom`, `blockedReason` | String \| null                 | set while blocked                                                            |
| `doneBy`, `doneAt`             | ObjectId \| null, Date \| null | who marked it done and when                                                  |
| `verifiedBy`, `verifiedAt`     | ObjectId \| null, Date \| null | verifier must differ from `doneBy`                                           |

Indexes: `{hotelId, stage, dueAt}`, `{hotelId, assigneeId, stage}`, `roomId`.

## taskUpdates (append-only log: rows are never edited or deleted)

| Field                    | Type           | Notes                                                                              |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------- |
| `hotelId`, `taskId`      | ObjectId       |                                                                                    |
| `kind`                   | String         | created, started, blocked, unblocked, done, verified, sent_back, cancelled, edited |
| `fromStage`, `toStage`   | String \| null | the stage change                                                                   |
| `note`                   | String \| null | reason or note                                                                     |
| `photos`                 | [{ url }]      | proof photos, `/uploads/<uuid>.jpg`                                                |
| `changes`                | Object \| null | for `edited`: `{ field: { from, to } }`                                            |
| `createdBy`, `createdAt` | ObjectId, Date | who and when (no `updatedAt`)                                                      |

Index: `{taskId, createdAt}`.

## migrations (managed by umzug)

One document per applied migration (`name`). Every schema or index change goes through a new file in `apps/api/src/db/migrations/`.
