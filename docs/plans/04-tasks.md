# Plan 04: Tasks & task updates

> Status: ✅ Approved and built (2026-11-21)
> Builds on Plans 02 (hotels) and 03 (rooms). Departments as a real module are **on hold**: for now a short fixed list lives in code (§2.3).

## 1. Goal

One generic way to track any piece of work at a hotel (clean a room, fix an AC, follow up a payment…) from creation to verified closure, so that:

- every task has an **owner, a deadline and a stage**;
- every change is recorded in an **append-only log** (who, when, what, proof);
- **closure needs proof** (photo and/or note) **and a second person's verification**;
- the app shows the same **progress bar + timeline** for every task.

Room status, the GM priority list and the HO dashboard will later be read from these tasks (not in this plan).

## 2. Data model

### 2.1 `tasks`: the current state of one task

```
tasks {
  _id,
  hotelId,
  title,            // "Clean room 101"   3–120 chars
  description,      // optional, ≤ 1000
  department,       // one of the fixed keys in §2.3
  roomId,           // optional: the room this is about (same hotel)
  assigneeId,       // optional: the user responsible (active user)
  dueAt,            // date + time
  stage,            // pending | in_progress | blocked | done | verified | cancelled
  blockedFrom,      // stage to return to when unblocked (set only while blocked)
  blockedReason,    // set only while blocked
  doneBy, doneAt,   // who marked it done, when (cleared if sent back)
  verifiedBy, verifiedAt,
  isActive, isDeleted, createdBy, updatedBy, createdAt, updatedAt
}
```

**Overdue** is worked out, not stored: `dueAt < now` and stage is pending / in progress / blocked. A task waiting for verification (`done`) is not overdue; it shows as "Waiting to verify".

### 2.2 `taskUpdates`: the log (never edited, never deleted)

```
taskUpdates {
  _id,
  hotelId,
  taskId,
  action,           // created | started | blocked | unblocked | done | verified | sent_back | cancelled | edited
  fromStage, toStage,
  note,             // optional; required for blocked / sent_back / cancelled (the reason) and for done if no photo
  photos,           // [{ url }] up to 3; only on done
  changes,          // only for "edited": { field: { from, to } } (title, due time, assignee…)
  createdBy, createdAt
  (isActive / isDeleted kept for the collection convention; never changed)
}
```

### 2.3 Departments (fixed list in `packages/shared`, for now)

| Key            | Label        |
| -------------- | ------------ |
| `housekeeping` | Housekeeping |
| `front_office` | Front office |
| `maintenance`  | Maintenance  |

Stored on the task as the key. When the departments module comes, these keys become its seed data.

### 2.4 Indexes (one migration)

| Collection    | Indexes                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `tasks`       | `{ hotelId, stage, dueAt }`; `{ hotelId, assigneeId, stage }`; `{ roomId }` |
| `taskUpdates` | `{ taskId, createdAt }`                                                     |

## 3. Lifecycle

```
pending ──start──▶ in_progress ──done (proof)──▶ done ──verify──▶ verified
   │                    │                          │
   ├──block──▶ blocked ◀┘                          └──send back (reason)──▶ in_progress
   │             └──unblock──▶ (stage it came from)
   └──cancel (reason): from pending / in_progress / blocked ──▶ cancelled
```

| Action      | From                          | Rule                                                                         |
| ----------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `start`     | pending                       |                                                                              |
| `block`     | pending, in_progress          | reason required                                                              |
| `unblock`   | blocked                       | returns to `blockedFrom`                                                     |
| `done`      | in_progress                   | **proof required: at least one photo or a note**                             |
| `verify`    | done                          | **must be a different person from whoever marked it done**                   |
| `send_back` | done                          | reason required; back to in_progress, `doneBy/doneAt` cleared                |
| `cancel`    | pending, in_progress, blocked | reason required                                                              |
| edit        | any open stage                | title, description, department, room, assignee, due time; logged as `edited` |

`verified` and `cancelled` are final. A wrong action for the current stage → **409 `INVALID_STAGE`**. Missing proof / reason → 400 on that field. Verifying your own work → **403 `SELF_VERIFY`**.

Each action moves the task only if it is still in the stage that was read (a conditional update, so two people can't move it at once), then writes its `taskUpdates` row. The local MongoDB is a single server without transactions; switch to a transaction if it becomes a replica set. Tasks are never deleted: cancel instead.

Permissions: none yet (Plan 01 Part B). Anyone signed in can do any step; who did it is always recorded.

## 4. Photos

- `POST /hotels/:hotelId/uploads` (multipart, one image, JPEG/PNG/WebP, ≤ 5 MB) → `{ url }`.
- For the pilot, files are saved on the API server in `apps/api/uploads/` under a random name and served at `/uploads/<name>`. Moving to cloud storage (S3 or similar) later only changes this one module.
- New packages: **`multer`** (API, file upload) and **`expo-image-picker`** (app, camera / gallery).
- The `done` action takes the returned URLs in `photos`.

## 5. API

| Method | Path                                 | Body / query                                                                                                            |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/hotels/:hotelId/tasks`             | `view` (open · waiting · closed · all), `department`, `assigneeId` (or `me`), `roomId`, `overdue`, `q`, `page`, `limit` |
| POST   | `/hotels/:hotelId/tasks`             | `title`, `department`, `dueAt`, `description?`, `roomId?`, `assigneeId?`                                                |
| GET    | `/hotels/:hotelId/tasks/:id`         | task + `room`, `assignee`, `doneBy`, `verifiedBy` summaries + `updates` (timeline)                                      |
| PATCH  | `/hotels/:hotelId/tasks/:id`         | edit fields (open stages only)                                                                                          |
| POST   | `/hotels/:hotelId/tasks/:id/actions` | `{ action, note?, photos? }`, one endpoint for every lifecycle step                                                     |
| GET    | `/hotels/:hotelId/tasks/summary`     | counts for Home: overdue, open, waiting to verify, closed today                                                         |
| POST   | `/hotels/:hotelId/uploads`           | multipart image                                                                                                         |

Lists sort overdue first, then by due time. `view=open` = pending / in progress / blocked; `waiting` = done; `closed` = verified / cancelled.

## 6. App

**New Tasks tab** in place of the Roles tab. Roles move to Profile → Administration, next to Hotels.

| Screen          | Contents                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks           | For the hotel selected on Home. Chips: Open · Waiting to verify · Closed · Mine · department. Rows: title, "Room 101 · Housekeeping · Ravi", due ("in 25 min" / red "2 h late"), stage pill. + to add.                 |
| Add / edit task | Title, department (drawer), room (searchable drawer, optional), assignee (drawer, optional), due day (Today / Tomorrow / next 7 days) + time (30-minute steps), description.                                           |
| Task detail     | **Progress bar** (Pending → In progress → Done → Verified; Blocked / Cancelled shown on it), due countdown, details, the action buttons allowed for this stage, then the **timeline** with notes and photo thumbnails. |
| Mark done sheet | Add photos (camera / gallery, up to 3) and a note; Done is enabled when there's at least one.                                                                                                                          |
| Reason sheet    | For block / send back / cancel: a required reason.                                                                                                                                                                     |

Reusable components: `StageProgress` (the bar) and `Timeline` (the log), written to work for any future record that has stages.

Also:

- **Quick add** gets "Add task".
- **Home**: the demo "Needs attention" numbers are replaced by real counts from `/tasks/summary` (overdue · open · waiting to verify · closed today). Arrivals / departures / occupancy stay demo until PMS data exists.

## 7. Tests

Create (validation, room from another hotel, inactive assignee) · each allowed action and its log row · wrong action for the stage (409) · done without proof (400) · verify own work (403) · send back clears done fields · unblock returns to the earlier stage · edits logged with from/to · cancelled and verified are final · list views, `me`, overdue filter and sort · summary counts · upload type and size limits · migration indexes.

## 8. Not in this plan

Departments module and HODs, permissions on actions, automatic task creation (PMS, checkout → cleaning), recurring tasks, room status worked out from tasks, notifications, escalations, GM priority list and HO dashboard, comments without a stage change.
