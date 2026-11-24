# Plan 10: What the "BYKE HO App Overview" asks for, and what is left

> Status: 📝 Draft, awaiting approval
> Source: `BYKE HO App Overview for Management.pdf` (19 Nov 2026).

## 1. Built vs the overview

| Overview says                                                                          | Today                                                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| One app, role-based screens                                                            | ✅ Permissions per role (Plan 06). Roles are global to a user                               |
| Property-scoped data                                                                   | ✅ Users mapped to hotels (Plan 05)                                                         |
| Issue with owner, deadline, proof; submitter cannot verify; rejected proof reopens     | ✅ Tasks (Plan 04/09): proof, verify by someone else, send back                             |
| Excel onboarding with preview and rejected-rows download                               | 🟡 Rooms only (Plan 07). 9 more templates missing                                           |
| Departments                                                                            | 🟡 Global list (Plan 09). The overview has **11 standard departments created per property** |
| In-app alert list                                                                      | ✅ Bell and list (Plan 09). **Push missing**                                                |
| Deadline missed alert                                                                  | 🟡 Overdue notice to assignees only. No GM / HO escalation                                  |
| Login with email **or phone**                                                          | 🟡 Email only (mobile number now stored)                                                    |
| Issues raised automatically from data (13 rules), feeds, auto-close when data recovers | ❌ Tasks are created by hand only                                                           |
| GM "Today" tab, HO health by six work areas, daily 09:15 summary, "What is working"    | ❌ Home shows task counts only                                                              |
| Special permissions (grant / block, expiry, reason), audit log                         | ❌                                                                                          |
| One person, different role per property                                                | ❌ One role per user                                                                        |
| Purchase request and approval, HK room checklist, marketing entries                    | ❌                                                                                          |
| Six standard roles (Admin, HO manager, GM, HOD, Supervisor, Staff)                     | 🟡 Roles exist; seed set not confirmed against the six                                      |

## 2. Proposed phases (smallest useful first)

1. **Alerts that matter (extends Plan 09 notifications):**
   - Deadline-missed escalation: GM at once, HO managers after 60 minutes.
   - Reminder 30 minutes before a deadline.
   - Daily 09:15 summary to the GM (property local time).
   - Proof submitted: tell the supervisor / GM to verify (done); proof rejected: owner (done).
   - **Push** via Expo push (needs a development build and a device token table).
2. **GM "Today" and HO health:** Today tab (do now, follow up, closed with proof, missing data); HO screen with every property by the six work areas, open and late counts, owners. Work area added to tasks and task masters (small field + filter).
3. **Roles per property and special permissions:** `userHotelRoles` (user, hotel or all, role), `specialPermissions` (grant or block, hotel or all, expiry, reason), `auditLog`. Permission check becomes roles at that hotel + grants − blocks. Biggest change to auth; needs your answers in §3.
4. **Rules and data feeds (issues from data):** `alertRules` per property (on/off, threshold, owner department, deadline, proof required), `dataFeeds` (source, due time, secret key shown once), webhook / Excel intake, rule engine that opens a task and auto-closes when data recovers. Start with the 13 rules in the overview, one work area at a time.
5. **Remaining Excel templates:** Property (creates its standard departments and rules), Departments, Room types (capacity, base rate), Users (one-time password shown once), User-to-property role, Role permissions, Special permissions, Data feeds, Alert rules. Same preview / reject / re-upload flow as rooms.
6. **Later modules:** purchase requests and approvals, HK room checklist, marketing entries, staffing and rosters.

## 3. Decisions needed

1. **Departments:** the overview creates 11 standard departments **per property**; we made one global list. Keep global (simpler) or per property?
2. **Roles per property** (phase 3): needed for the pilot, or can everyone keep one role for now?
3. **Which phases for the Astara pilot (23 Nov)?** My suggestion: 1 then 2, then 4 for housekeeping readiness only.
4. **Data source:** Trustify PMS and Revyog: do we get API / webhook access, or Excel uploads first?
5. **The 11 standard departments** and the **13 rule thresholds:** please send the lists.
6. **Server:** the overview says NestJS; we are on Express. Assumed unchanged.

## 4. Not planned

Redis queue (the overview marks it optional), email alerts, email verification (postponed in Plan 09).
