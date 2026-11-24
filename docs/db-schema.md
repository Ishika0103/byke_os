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
                          ├──* roomtypes 1───* rooms
                          └──* tasks 1───* taskupdates
tasks ──(optional)── rooms,  tasks ──* users (assigneeIds),  tasks ── departments
tasks ──(optional)── taskmasters (predefined title)
```

## roles

| Field         | Type     | Notes                                                                                                      |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `name`        | String   | 2–50 chars, unique ignoring case                                                                           |
| `code`        | String   | UPPERCASE, unique, never changes (`SUPER_ADMIN`, `HO`, `GM`, `HOD`, `STAFF`)                               |
| `permissions` | [String] | named permissions, e.g. `view-hotel`, `add-room`; Super Admin = `['*']`; other roles start empty (Plan 06) |

Indexes: `code` unique, `name` unique case-insensitive (both partial on `isDeleted:false`).

## users

| Field           | Type                     | Notes                                                                                           |
| --------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `name`          | String                   | 2–80 chars                                                                                      |
| `email`         | String                   | lowercase, unique                                                                               |
| `roleId`        | ObjectId → roles         | one role per user                                                                               |
| `hotelIds`      | [ObjectId → hotels]      | hotels the user works at; empty for Super Admin (Plan 05)                                       |
| `departmentIds` | [ObjectId → departments] | departments the user belongs to; required (at least one) when created through the API (Plan 09) |
| `hashPassword`  | String                   | bcrypt hash, never returned by the API                                                          |

Indexes: `email` unique (partial), `roleId`, `hotelIds`, `departmentIds`.

## departments

Global master list (not per hotel), managed in the app. Seeded by migration: Housekeeping (`HK`), Front Office (`FO`), Maintenance (`MT`), Food & Beverage (`FB`). Delete is blocked while a user belongs to the department.

| Field  | Type   | Notes                                                      |
| ------ | ------ | ---------------------------------------------------------- |
| `name` | String | 2–50 chars, unique ignoring case                           |
| `code` | String | generated from the name (e.g. `HK`), unique, never changes |

Indexes: `name` unique case-insensitive, `code` unique (both partial).

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

## roomtypes

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

| Field            | Type                 | Notes                                                       |
| ---------------- | -------------------- | ----------------------------------------------------------- |
| `hotelId`        | ObjectId → hotels    | never changes                                               |
| `roomTypeId`     | ObjectId → roomtypes |                                                             |
| `roomNumber`     | String               | up to 10 chars, unique per hotel                            |
| `floor`          | Number \| null       | -5 to 200                                                   |
| `isSellable`     | Boolean              | default true                                                |
| `notes`          | String \| null       | up to 500 chars                                             |
| `importFileUrl`  | String \| null       | Excel file that last created or changed this room (Plan 11) |
| `importFileName` | String \| null       | name of that Excel file                                     |

Indexes: `{hotelId, roomNumber}` unique (partial), `roomTypeId`, `{hotelId, floor}`.

## tasks (current state of a task)

| Field                          | Type                           | Notes                                                                        |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------- |
| `hotelId`                      | ObjectId → hotels              | never changes                                                                |
| `title`                        | String                         | 3–120 chars                                                                  |
| `description`                  | String \| null                 | up to 1000 chars                                                             |
| `taskMasterId`                 | ObjectId \| null               | predefined title it came from; null for a typed ("Other") title              |
| `groupId`                      | ObjectId                       | tasks created together (one per room) share it; never changes                |
| `departmentId`                 | ObjectId → departments         |                                                                              |
| `roomId`                       | ObjectId \| null               | optional single room (one task per room)                                     |
| `assigneeIds`                  | ObjectId[]                     | users who must work at the hotel (or Super Admin); empty = unassigned        |
| `dueAt`                        | Date                           |                                                                              |
| `stage`                        | String                         | `pending` → `in_progress` → `done` → `verified`; also `blocked`, `cancelled` |
| `blockedFrom`, `blockedReason` | String \| null                 | set while blocked                                                            |
| `doneBy`, `doneAt`             | ObjectId \| null, Date \| null | who marked it done and when                                                  |
| `verifiedBy`, `verifiedAt`     | ObjectId \| null, Date \| null | verifier must differ from `doneBy`                                           |

Indexes: `{hotelId, stage, dueAt}`, `{hotelId, assigneeIds, stage}`, `{hotelId, departmentId, stage}`, `groupId`, `roomId`.

## taskmasters (predefined task titles, seeded by migration only)

| Field          | Type             | Notes                                               |
| -------------- | ---------------- | --------------------------------------------------- |
| `title`        | String           | 3–120 chars, unique ignoring case                   |
| `type`         | String           | `service` \| `complaint` \| `order` \| `request`    |
| `departmentId` | ObjectId \| null | default department; changeable when creating a task |

Seed: Room Cleaning, Guest Complaint, Food Order, Maintenance Request, Laundry. Index: `title` unique (case-insensitive, partial on `isDeleted: false`). Read-only API: `GET /task-masters`.

## taskupdates (append-only log: rows are never edited or deleted)

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

## notifications (in-app, one row per recipient)

| Field       | Type              | Notes                                                                                                                      |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `userId`    | ObjectId → users  | the recipient; users only ever read their own                                                                              |
| `hotelId`   | ObjectId → hotels |                                                                                                                            |
| `taskId`    | ObjectId \| null  | task to open on tap                                                                                                        |
| `kind`      | String            | task_assigned, task_started, task_blocked, task_done, task_sent_back, task_verified, task_needs_verification, task_overdue |
| `title`     | String            | up to 200 chars                                                                                                            |
| `body`      | String \| null    | up to 1000 chars                                                                                                           |
| `readAt`    | Date \| null      | null = unread                                                                                                              |
| `dedupeKey` | String (optional) | e.g. `overdue:<taskId>`; a user never gets the same key twice                                                              |

Indexes: `{userId, readAt, createdAt:-1}`, unique partial `{userId, dedupeKey}` (where `dedupeKey` is a string).

## consumptionmodulemasters (the six consumption modules, seeded by migration only)

Not the `departments` collection.

| Field       | Type   | Notes                                                                            |
| ----------- | ------ | -------------------------------------------------------------------------------- |
| `name`      | String | F&B, Engineering, Housekeeping, Electricity, Water, Fuel (unique, ignoring case) |
| `code`      | String | FB, ENG, HK, ELEC, WATER, FUEL (unique)                                          |
| `sortOrder` | Number | 1 to 6, column order on screens                                                  |

## fnbdailyconsumptions, engineeringdailyconsumptions, housekeepingdailyconsumptions

One collection per module (F&B, Engineering, Housekeeping), same shape, one row per property and date. Filled by `POST /consumption/sync`, which reads a hardcoded Google Sheet; only its **Consumption** column is used. A row for the same property, date and module is updated, otherwise created. Modules without a collection yet (Electricity, Water, Fuel, Others) are rejected by the sync.

| Field          | Type              | Notes                                             |
| -------------- | ----------------- | ------------------------------------------------- |
| `hotelId`      | ObjectId → hotels | found from the sheet's Property Code              |
| `propertyCode` | String            | the code as in the sheet                          |
| `date`         | Date              | the calendar day at **00:00 UTC**; read it in UTC |
| `module`       | String            | FB, ENG or HK (same as the collection)            |
| `isMarked`     | Number            | 0 = not marked, 1 = marked                        |

Indexes (each collection): unique partial `{hotelId, date, module}`, `{date:-1, hotelId}`.

## migrations (managed by umzug)

One document per applied migration (`name`). Every schema or index change goes through a new file in `apps/api/src/db/migrations/`.
