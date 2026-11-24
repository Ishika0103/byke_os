# Plan 12: Task verifier

> Status: ✅ Approved (2026-11-24), open questions 1-4 accepted with the recommended answers
> Builds on Plan 04 (tasks) and Plan 09 (new task flow, notifications).

## 1. Goal

Today anyone with the task permission can verify finished work (the only rule is that the person who marked it done can't). Change this so that **a verifier is chosen when the task is created, and only that person can verify it.**

**Out of scope (later, via the role permissions tab, Plan 06):** limiting who sees the "Add task" tab / can create tasks.

## 2. Rules

1. Creating a task requires choosing **one verifier**: an active user of the same hotel.
2. Only the verifier can run the `verify` action. The API rejects anyone else with `403 NOT_VERIFIER`.
3. The verifier **cannot be one of the assignees** (they could verify their own work). This keeps the existing `SELF_VERIFY` check as a second safety net (doneBy ≠ verifier).
4. `send_back` (rejecting done work) is also verifier-only, since it is the other half of verification.
5. The verifier can be changed while the task is open, through the existing edit flow (logged as an `edited` change). The new verifier is notified.
6. The verifier is notified when the task is marked done ("Needs your verification"), replacing today's notify-the-creator.

7. **Verification can carry photos.** The `verify` action accepts multiple photos (same upload rules and limit as `done`, `MAX_TASK_PHOTOS`), shown in the timeline entry. Photos stay optional on verify; a note is optional too. Photos on `send_back` are not added (not asked).
8. **Blocked is removed.** The `block` / `unblock` actions and the `blocked` stage go away. Remaining stages: pending → in_progress → done → verified, plus cancelled. Existing blocked tasks are moved back to the stage they were blocked from (`blockedFrom`, else `pending`). Old `blocked` / `unblocked` timeline entries stay readable (the log is never edited), only the UI/API stop creating them.

## 3. Changes

### Shared (`packages/shared/src/schemas/task.ts`)

- `createTaskSchema` / `updateTaskSchema`: add `verifierId` (ObjectId; required on create).
- `TaskDetail` / list item: add `verifier: PersonSummary`; add a computed `canVerify` flag for the current user so the app doesn't guess.
- Refine: `verifierId` not in `assigneeIds`.

### Database (migration, new file)

- Backfill `tasks.verifierId = createdBy` for existing tasks, so open tasks keep working. Add index `{ hotelId, verifierId, stage }` (for "waiting for my verification").
- Move tasks with `stage: 'blocked'` back to `blockedFrom` (else `pending`) and unset `blockedFrom` / `blockedReason`. `down()` is a no-op for this part (the old blocked state can't be recovered).
- Shared: remove `block` / `unblock` from `TASK_ACTIONS`, `blocked` from the stages, and `blockedFrom` / `blockedReason` from the task types and schema; allow `photos` on `verify` (validation message "Photos are only for marking done or verifying").
- API: drop the block/unblock cases, blocked notifications and the "overdue includes blocked" logic; store `photos` on the verify log entry.
- App: remove the Block / Unblock buttons and blocked styling (progress bar, format helpers, Home counts); add the photo picker to the Verify sheet (reuse the one from Done).

### API (`modules/tasks`)

- `task.model.ts`: `verifierId` field.
- `task.service.ts`: validate the verifier (same hotel, active, not an assignee); enforce rules 2 and 4 in `act()`; handle `verifierId` in edit; change notifications per rule 6.
- Tests (`tests/tasks.test.ts`): non-verifier gets 403 on verify and send_back; verifier succeeds; verifier among assignees rejected; create without verifier rejected.

### App (`apps/mobile`)

- New task screen: "Verifier" picker (single user of the hotel, assignees excluded).
- Task detail: show the verifier; show Verify / Send back buttons only when `canVerify`.
- Tasks tab / Home: "Waiting for my verification" uses the verifier, not the creator.

## 4. Open questions

1. Should the verifier default to the creator in the picker (creator can still pick someone else)? Recommended: yes.
2. Can GM / HO override and verify any task? Recommended: no for now, the verifier alone, and reassign through edit if the verifier is away.
3. Keep the same maximum number of photos for verify as for done? Recommended: yes.
4. Can the creator also be the verifier? Recommended: yes, as long as they aren't an assignee.
