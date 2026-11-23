# Plan 05: User ↔ hotel mapping

> Status: 📝 Draft, awaiting approval
> Phase 1, item 1 of the roadmap from the HO App Overview ("Property-specific by design: a user at one property cannot see another's data").

## 1. Decisions

| Question                    | Decision                                                                          |
| --------------------------- | --------------------------------------------------------------------------------- |
| Role per hotel or per user? | **One role per user**, the same at all their hotels                               |
| Hotels required?            | **At least one hotel** for every user, except Super Admin                         |
| "All hotels" option for HO? | **No.** Admin picks the hotels in the app; new hotels are added to people by hand |

## 2. Data

```
users {
  ...existing fields,
  hotelIds: [ObjectId]   // hotels this user works at; [] only for Super Admin
}
```

Migration:

- index `{ hotelIds: 1 }`;
- backfill `hotelIds: []` on existing users. Existing non-admin users then see no hotel until an admin maps them (the seeded admin is Super Admin, so unaffected).

**Super Admin** (the seeded system role) sees every hotel and needs no mapping. Until permissions (Plan 01 Part B) exist this is checked by the system role; Part B replaces it with a permission.

## 3. Rules

| Rule                                                                                       | Error               |
| ------------------------------------------------------------------------------------------ | ------------------- |
| Non-Super-Admin user with no hotels (create, edit, or changing role away from Super Admin) | 400 on `hotelIds`   |
| Unknown or deleted hotel id; duplicates are removed                                        | 400 on `hotelIds`   |
| Inactive hotels can be assigned (they come back when reactivated)                          | allowed             |
| A hotel that still has users mapped to it can't be deleted                                 | 409 `HOTEL_IN_USE`  |
| A task's assignee must be mapped to the task's hotel (or be Super Admin)                   | 400 on `assigneeId` |

## 4. Access (the security part)

Checked by the API on every request, from the database (so a change applies at once, without signing in again):

- `GET /hotels` returns only the user's hotels; `GET /hotels/:id` of another hotel → **404**.
- Everything under `/hotels/:hotelId/...` (room types, rooms, tasks, uploads) → **403** if the user isn't mapped to that hotel. This goes in the existing `requireHotel` check.
- `GET /auth/me` includes `hotelIds`.
- Not in this plan: hiding other hotels' **users** from the users list and limiting who can create hotels or users; those come with permissions (Part B).

## 5. API changes

| Endpoint                          | Change                                                                  |
| --------------------------------- | ----------------------------------------------------------------------- |
| `POST /users`, `PATCH /users/:id` | accept `hotelIds` (array of ids); validated as above                    |
| `GET /users`                      | new filter `hotelId`; each user includes `hotels: [{ id, name, code }]` |
| `GET /users/:id`, `/auth/me`      | include `hotels`                                                        |

## 6. App

- **New `MultiSelectField`**: opens a drawer with search and a tick per option, "Done" to close; the field shows the chosen items as chips ("Astara ×", "Old Anchor ×"). Reusable for later multi-selects.
- **Add / Edit user**: "Hotels" field, required unless the chosen role is Super Admin (then hidden, with the note "Super Admin can see every hotel").
- **Users list**: each row shows the user's hotel codes ("AST · OAB"); new **Hotel** filter chip.
- **Home hotel picker**: lists only the user's hotels (comes from the filtered API, no extra work). A user with no hotels sees "You're not added to any hotel yet. Ask your admin."
- **Profile**: shows "Hotels: Astara, Old Anchor".
- **Task form**: "Assigned to" lists only users at that hotel.

## 7. Tests

Create / update with hotels; required unless Super Admin; bad / deleted ids; duplicates removed; hotel list and hotel detail scoped; 403 on another hotel's rooms / tasks / uploads; Super Admin sees all; hotel with users can't be deleted; task assignee must be at the hotel; users `hotelId` filter; migration index.

## 8. Not in this plan

Different roles per hotel, "all hotels" option, permissions and the department filter (Plan 01 Part B), Excel import of users.
