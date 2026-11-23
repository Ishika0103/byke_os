# Plan 09: Departments, task flow, notifications and cleanups

> Status: ✅ Built (2026-11-24): cleanups, mobile number, import batching, departments, task masters + new task flow, in-app notifications. Email verification postponed; push later.
> Source: the list from the team (Home cleanup, import speed, email verification, mobile number, quick-add menu, Department master, task flow with task masters, task module with notifications).

## 0. Decisions so far (your answers)

- **Task master `type`:** a **fixed list** (proposed values: Service, Complaint, Order, Request).
- **Task masters:** **seeded list only** for now, no screen to edit them.
- **Mobile number:** 10-digit Indian number, **required** for new users.
- **Departments:** global for all hotels, and a user's departments are **required**.
- **Email verification:** **left for now** (out of this plan).
- **"+" button:** **removed completely** (not only the three entries). Adding things happens from each screen (Add task on the Tasks screen, Add user on Users, and so on).
- **Notifications:** in-app first (bell and list); push later. (No answer on this one, so the proposal stands.)
- **Import speed:** to be **measured by me first** (you said "need to check").
- **Many rooms in one task:** my recommendation is in §7a; waiting for your go-ahead.

## 1. Summary of what is asked and what changes

| #   | Ask                                                                              | What it means                                                                                                        | Size                |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Remove **Property listing** from Home                                            | Home loses the "Property" section (the hotel row and the "Byke OS server" row). The hotel switcher at the top stays  | Small               |
| 2   | **Importing takes time**                                                         | The rooms Excel import is slow. Find why and fix it (§3)                                                             | Small–medium        |
| 3   | **Mail auth verification**                                                       | Email verification for users (§4). Needs an email service                                                            | Medium, needs setup |
| 4   | **Mobile number** on Add user                                                    | New `mobile` field on users (§5)                                                                                     | Small               |
| 5   | **"+" menu: remove Add user, Add role, Add hotel**                               | The round + button no longer offers those three. They stay available inside their own screens (Users, Roles, Hotels) | Small               |
| 6   | **Department master**, used in user creation (**multiple departments per user**) | New `departments` collection with its own screens; users get `departmentIds` (§6)                                    | Medium              |
| 7   | **Task flow** with predefined titles from **task masters**                       | Title → Department → Rooms (multiple) → Details → Who and when (multiple users) (§7)                                 | Large               |
| 8   | **Task module complete with notifications**                                      | In-app notifications for task events, push later (§8)                                                                | Large               |

## 2. Order of work (so something useful is finished first)

1. **Quick cleanups** (1, 5): Home and "+" menu. No data change.
2. **Mobile number** (4) and **import speed** (2).
3. **Departments** (6): master, screens, users, migration of tasks off the fixed list.
4. **Task masters and the new task flow** (7): data change and new screens.
5. **Notifications** (8): in-app first.
6. **Email verification** (3): last, because it needs an email account / provider from you.

Each step ends green (lint, typecheck, tests) and is checked in the browser. **Doing all of this by end of today is not realistic** (steps 3–5 are each a module with migrations, API, screens and tests). See §9 for what I'd aim for today.

## 3. Import speed (2)

Likely cause (to be measured first, not assumed): the import saves **one room per database call**, one after another, and the app uploads the file **twice** (preview, then confirm), each time parsing it again.

Plan: measure a 2,000-row file; save all new rooms in **one batch insert** and all updates in **one bulk write**; look up room types and existing rooms in one query each (already so). Target: a few seconds for 2,000 rows. Keep the exact same row-by-row reporting and validation. If the preview parse itself is the slow part, cap the sample at fewer rows and read only the needed columns.

## 4. Email verification (3), needs your decision

"Mail auth verification" can mean several things. The simplest useful one:

- Users get `emailVerifiedAt`. When Super Admin creates a user, the system **emails a verification link**. Opening it marks the email verified.
- **Existing users** are treated as already verified (migration), so nobody is locked out.
- Whether an unverified user may sign in is **your call** (see questions).
- Needs: an **email provider** (company SMTP, Gmail app password, SendGrid or similar), sender address, a public URL for the link (the Render web URL), new env vars (`SMTP_*`, `APP_URL`) in `config/env.ts` and `.env.example`, a small email template, rate limiting on resend.

Without the email account I can build the code and test it with a fake mail sender, but I can't prove it sends real mail.

## 5. Mobile number on users (4)

- `users.mobile` (String). Proposed rule: **10-digit Indian mobile**, starting 6–9 (`9876543210`); a `+91` prefix is accepted and removed. Stored as the 10 digits.
- **Required on Add user?** Proposed: **required for new users**, optional for existing ones (they have none today). Not unique.
- Add and Edit user forms get a "Mobile number" field; the user list and detail show it.
- Migration: no data change (existing users have no mobile). Indexes: none (searchable by the existing search box).

## 6. Departments (6)

**New collection `departments`:** `name` (unique ignoring case), `code` (generated like room type codes, e.g. `HK`), plus the usual fields.

- **Global**, the same list for every hotel (proposal; per-hotel departments would need a hotel on each).
- **Seeded** by migration with the three that exist today: Housekeeping, Front office, Maintenance. Others (Food & Beverage, Security…) are added in the app.
- **Permissions:** a new **Departments** row in the permissions grid (`view-department`, `add-department`, `edit-department`, `delete-department`).
- **Screens:** Settings → **Departments** (list, search, add, edit, active / inactive, delete). Delete is blocked while users or tasks use the department.
- **Users:** `users.departmentIds[]` (**multiple**). The Add / Edit user form gets a multi-select "Departments" (same control as Hotels). Proposed: **optional** for every role; HODs and staff normally have one or more.
- **Tasks:** `tasks.department` (a fixed key) becomes `tasks.departmentId`. Migration maps `housekeeping`, `front_office`, `maintenance` to the seeded departments; the task filters and screens use the master list. The fixed `DEPARTMENTS` list in the code is removed.

## 7. Task masters and the new task flow (7)

**New collection `taskMasters`** (the predefined titles):

| Field          | Notes                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `title`        | e.g. Room Cleaning, Guest Complaint, Food Order. Unique ignoring case                                               |
| `type`         | A label grouping the master (e.g. `service`, `complaint`, `order`). Free text or a small fixed list (see questions) |
| `departmentId` | Default department for this title (optional); the user can change it in the flow                                    |
| usual fields   | `isActive`, `isDeleted`, `createdBy`, …                                                                             |

Seeded with the three you named; the rest of the list comes from you. **"Other…"** is always the last choice and lets the user type their own title (it is not stored in the master).

**Task flow (create screen, one step per section):**

1. **Title:** pick from the masters, or **Other** and type it.
2. **Department:** pre-filled from the master, can be changed.
3. **Rooms (multiple):** pick several of the hotel's rooms (with search). Optional for tasks that aren't about rooms (proposal).
4. **Details:** description.
5. **Who and when:** pick **several users** (only people added to this hotel, and in the chosen department when they have one), and the due date and time.

**Data change on `tasks`:**

| Today              | After                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| `department` (key) | `departmentId`                                                                      |
| `roomId` (one)     | `roomIds[]`                                                                         |
| `assigneeId` (one) | `assigneeIds[]`                                                                     |
| `title` (text)     | `title` (text, copied from the master or typed) and `taskMasterId` (null for Other) |

A migration converts every existing task (`roomId` → `[roomId]`, `assigneeId` → `[assigneeId]`, department key → department id). Indexes become `{ hotelId, assigneeIds, stage }` and `{ roomIds }`. The API, shared schemas, filters ("assigned to me" matches any of the assignees), counts, list rows, detail and edit screens, and tests are updated.

**How a task with many rooms and users behaves (proposal, simplest):** it is **one task**.

- **Any assignee** can start it, block it or mark it done, with proof as today; the timeline shows who did what.
- **Verification** still needs a person **other than the one who marked it done**.
- All the rooms are shown on the task. Individual rooms are not tracked separately.

If each room needs its own done / verified state, the better model is **one task per room** created together (same title, users and time). That is more work (a group of tasks) and I'd only do it if you need per-room closure. See questions.

**Task masters management:** seeded by migration. A Settings → Task titles screen to add or edit masters is **not** in this plan unless you want it (questions).

## 7a. One task per room (my recommendation)

Create a task for several rooms as **one task per room, created together** and linked by a shared `groupId`; every one of them is given to the same users with the same due time. Why:

- A room is the real unit of work. Room 101 can be cleaned and verified while 102 is still open; one task for ten rooms would be "half done" with no way to say which half.
- Proof photos, verification and "late" are per room, which is what HO wants to see.
- **Less change to the data:** `roomId` stays a single room, so only `assigneeId` → `assigneeIds[]` and `department` → `departmentId` change (no `roomIds[]`).
- The create screen still shows "Rooms (multiple)", and the Tasks list can show them together by `groupId` later.

Tasks that aren't about a room create one task with no room. If you'd rather have a single task holding all rooms, say so and §7 stands as written.

## 8. Notifications (8)

Done in two layers:

1. **In-app notifications (in this plan).** New `notifications` collection: `userId`, `hotelId`, `taskId`, `kind`, `title`, `readAt`, plus the usual fields. A notification is created for the right people when:
   - a task is **assigned** to you (create, or you were added);
   - a task you assigned or created is **started, blocked, done, sent back or verified**;
   - a task needs **your verification** (done by someone else);
   - a task is **overdue** (a check that runs on the server every few minutes; proposal).

   The app gets a **bell on Home** with an unread count, a **notifications list** (tap opens the task, mark read, mark all read), and the list refreshes when the app comes back to the front. API: `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/unread-count`. Each user sees only their own.

2. **Push notifications (not in this plan, next step).** Needs an Expo **development build** (push does not work in Expo Go on Android), a Firebase / Apple key, device token registration and a sender. Push can be added on top without changing the in-app part, because both are created from the same events.
3. **Email** for tasks: not planned.

## 9. What I'd aim for today

Steps 1–4 of §2 (cleanups, mobile number, import speed, departments) and the **task masters + new task flow** if the answers come early. **In-app notifications** next; **email verification** and **push** only once the email account / build setup exist. I'd rather finish fewer things green than leave the task module half-migrated.

## 10. Tests

- Migrations: departments seeded; tasks converted (single room / assignee → arrays, department key → id); down works.
- Departments CRUD, in-use delete block, permissions.
- Users: mobile validation (10 digits, `+91` stripped), departments saved and returned, filters.
- Task masters: list, "Other" path, department pre-fill.
- Tasks: create with several rooms and users (all must belong to the hotel), "assigned to me" matches any assignee, lifecycle with several assignees, verification by someone other than the doer.
- Notifications: created for the right users on each event, own-only access, unread count, mark read.
- Import: 2,000 rows within a time limit; same reporting as before.
- Browser checks of every changed screen.

## 11. Still open

1. **Go-ahead on §7a** (one task per room), or one task with all rooms?
2. **Seed list for task masters** (proposed, change as needed): Room Cleaning (Housekeeping, Service), Guest Complaint (Front Office, Complaint), Food Order (Food & Beverage, Order), Maintenance Request (Maintenance, Request), Laundry (Housekeeping, Service). **Type values:** Service, Complaint, Order, Request. **Departments seeded:** Housekeeping, Front Office, Maintenance, Food & Beverage.
3. Notifications: in-app (bell and list) is assumed unless you say otherwise.
