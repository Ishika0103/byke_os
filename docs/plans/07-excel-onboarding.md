# Plan 07: Rooms onboarding by Excel (import and export, per hotel)

> Status: ✅ Built (2026-11-24), with these decisions that replace the text below where they differ:
>
> - **Columns:** `Hotel Code`, `Room Type Code`, `Room Number` only (codes, not names; a raw id is also accepted). **No Status column**: new rooms are always Active, and an import never changes an existing room's status. Hotel Code is pre-filled in the sample and must be the open hotel's, so the hidden Meta sheet isn't used. The sample has just Instructions and Rooms sheets (room type codes and names are listed on Instructions; the dropdown holds the codes).
> - **Floor, Sellable and Notes are not in the Excel, and §7a (removing them from the database) was NOT applied.** New rooms get the defaults (no floor, sellable, no notes); existing values are never changed by an import.
> - Re-uploading **updates** existing rooms (needs `edit-room`); **valid rows are saved** and bad rows are reported.
> - **Export** is a button on the Import screen (the rooms header keeps three buttons so its title fits).
> - A row without a Room Number is ignored (the sample ships with the hotel code pre-filled on 300 rows).
>   Scope changed from the first draft: **rooms only**, for **one hotel at a time**. Hotels and room types are created in the app first (locations come from Plan 08). Hotel and room type Excel import is not in this plan.

## 1. Flow

1. On a hotel's **Rooms** screen the admin taps **Import / Export**.
2. **Download sample**: an Excel file for **this hotel**, with that hotel's room types in a dropdown. Optionally pick a room type first, so the file comes with that room type already filled in and the user only types room numbers.
3. Fill it: just the room number (and the room type) per row.
4. **Upload** it. A **preview** shows how many rooms are **new**, **updated**, **unchanged** and **rejected**, with the reason for each rejected row. Nothing is saved yet.
5. **Confirm**: valid rows are saved; a result screen shows what was created, updated and skipped.
6. **Download rejected rows** as Excel (same columns plus a Reason column), fix and upload again.
7. **Export** downloads the hotel's current rooms in the same format, so export → edit → import works as a bulk edit (for example moving rooms to another room type).

## 2. How hotel and room type are mapped

Nobody types an id in Excel. The server maps them:

| Needed         | Where it comes from                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **hotelId**    | The **hotel the user opened** in the app. It is in the upload URL (`/hotels/:hotelId/rooms/import/...`), like every other hotel screen. Every room in the file is saved to that hotel. The hotel scope check (Plan 05) applies, so a user can only import to hotels they are added to |
| **roomTypeId** | The **Room Type column**: the room type's name, looked up **inside that hotel**. The sample's dropdown lists only that hotel's active room types, so users pick instead of typing. An unknown name is rejected on that row                                                            |

**Wrong-hotel protection:** the downloaded file carries the hotel's id and code in a hidden **Meta** sheet. If a file made for hotel A is uploaded while hotel B is open, the whole upload is refused ("This file is for Astara, but you opened Brightland"). This stops rooms landing in the wrong hotel by mistake. A file without the Meta sheet (made by hand) is still accepted, and the open hotel is used.

Room types are per hotel, so "Deluxe" at Astara and "Deluxe" at Brightland are different room types. The lookup only ever sees the open hotel's.

## 3. Excel columns

`*` = required. One sheet, **Rooms**, plus an **Instructions** sheet and hidden **Meta** and **Lists** sheets. Header names are exact; column order doesn't matter.

| Column          | Required | Rules                                                                                                     | Example |
| --------------- | :------: | --------------------------------------------------------------------------------------------------------- | ------- |
| **Room Number** |    ✓     | Up to 10 letters, digits or `-`; stored uppercase; unique within the hotel                                | 101     |
| **Room Type**   |    ✓     | Name of one of this hotel's room types (dropdown). Filled in if the file was downloaded for one room type | Deluxe  |

Export adds a read-only **Room Type Code** column (e.g. `DLX`) for reference; it is ignored on import. The sample has two example rows. Room numbers are read as text, so Excel turning `101` into a number is handled.

## 4. Matching (new or update)

A room is matched by **hotel + room number** (uppercase). Found → **updated** if any column differs, otherwise **unchanged**. Not found → **created**. Moving a room to another room type is an update to its Room Type cell. Nothing is ever deleted through Excel; a missing row does nothing. Import never changes a room's active status.

Rejected rows (with the reason shown): missing or too-long room number, bad characters, unknown or inactive room type, a room number appearing twice in the file ("Duplicate of row 5"), more rows than the limit.

## 5. API (same layering as other modules)

All under the hotel, behind `requireHotel` (so scope is checked):

| Endpoint                                      | Permission                             | Does                                                                                                                    |
| --------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET /hotels/:hotelId/rooms/import/sample`    | `add-room`                             | Sample `.xlsx` for this hotel. Optional `?roomTypeId=` pre-fills the Room Type column                                   |
| `POST /hotels/:hotelId/rooms/import/preview`  | `add-room`                             | Upload (multipart, field `file`). Validates, **saves nothing**, returns counts and every row with its action and errors |
| `POST /hotels/:hotelId/rooms/import/commit`   | `add-room` (+ `edit-room` for updates) | Same upload again; validates again and saves the valid rows; returns the result                                         |
| `POST /hotels/:hotelId/rooms/import/rejected` | `add-room`                             | Same upload; returns an `.xlsx` of only the rejected rows with a Reason column                                          |
| `GET /hotels/:hotelId/rooms/export`           | `view-room`                            | The hotel's rooms as `.xlsx` (optional `?roomTypeId=`)                                                                  |

- Routes go **before** `/:id` so `import` and `export` aren't read as room ids.
- The app keeps the picked file and sends it again on Confirm, so the server stores nothing between preview and commit.
- **The existing rules are reused**: the shared room field rules and `roomService` (the room type belongs to this hotel and is active, the number is unique), so Excel and the app behave identically. Created and updated rooms record `createdBy` / `updatedBy`.
- **Each row is saved on its own** (no transaction on a single server): a row that fails at save time is reported as rejected and the rest carry on. Valid rows are saved even if others are rejected.
- **Files:** `.xlsx` only, checked by content (not just the extension), up to **5 MB** and **2,000 rows** per upload. Export text starting with `=`, `+`, `-` or `@` is written as plain text so Excel can't run it as a formula.
- **Library:** `exceljs` (reads and writes `.xlsx`, supports dropdowns and hidden sheets), added with `npm install -w @byke-os/api exceljs`. `multer` is already in the project.
- **Permissions:** with `add-room` a user can import new rooms; rows that would **update** an existing room also need `edit-room`, otherwise they are rejected ("You can't edit rooms"). Export needs `view-room`.

## 6. App

- **Rooms screen** (inside a hotel): header gets **Import** and **Export** buttons, shown by permission (`<Can>`: Import needs `add-room`, Export needs `view-room`).
- **Export** downloads `rooms-AST-2026-11-24.xlsx`.
- **Import screen** (one page, steps):
  1. Optional room type picker, then **Download sample file**.
  2. **Choose Excel file** (`.xlsx` only).
  3. **Preview**: tiles for New, Updated, Unchanged, Rejected, and the list of rejected rows ("Row 14, Room Type: 'Deluxx' not found in this hotel"), with **Download rejected rows**.
  4. **Confirm import** (disabled if nothing is valid), then a result card ("38 rooms created, 2 updated, 5 skipped") and **Done**.
- **Downloading and picking files:** works in the browser first (blob download and file input). On Android and iOS the file picker and share sheet are used; the package is chosen against the **SDK 58** docs when building (`npx expo install`).
- New `features/room-import/` (api, hooks, components) and a screen under the hotel's rooms routes.

## 7. Data

Import creates and updates ordinary rooms. The only schema change is removing three room fields (§7a).

## 7a. Fields removed from rooms (NOT applied: you asked for Excel only)

Rooms keep only: `hotelId`, `roomTypeId`, `roomNumber` and the usual fields (`isActive`, `createdBy` …). **`floor`, `isSellable` and `notes` are removed** from the `rooms` collection.

- **Migration** (new file, `up` removes the three fields from every room and drops the `{ hotelId, floor }` index; `down` restores the index only, the removed values can't come back). **This deletes the stored floor, sellable and notes values** on existing rooms.
- **Shared schemas and API:** room create, update and bulk create lose the three fields; the room list loses the floor filter; the room service and model are trimmed.
- **App:** the room form, bulk-add form, room list rows, room filters and the hotel screen's room counts lose floor, sellable and notes. Task screens that show a room's floor show just the room number.
- **Tests and docs:** room tests, the migrations test and `docs/db-schema.md` / Plan 03 updated.
- "Sellable" was meant to leave staff and store rooms out of inventory; with it gone every room counts as a room.

## 8. Tests

- Sample: opens, has the Rooms sheet, the room type dropdown holds only this hotel's active room types, the Meta sheet has the hotel id; pre-filled when `roomTypeId` is given.
- Preview saves nothing; commit saves; **uploading the same file again** → all unchanged, no duplicates.
- Changing the room type or status → updated; untouched rows stay unchanged.
- A room type with the same name in **another hotel** is not accepted; hotel scope (a user not added to the hotel gets 403).
- A file made for another hotel is refused; a file without Meta is accepted.
- Row errors with row and column: bad number, too long, duplicate in file, unknown or inactive room type; valid rows still saved.
- Permissions: no `add-room` → 403; update rows need `edit-room`; export needs `view-room`.
- Wrong file type, over 5 MB, empty file, missing columns, over 2,000 rows → clear 400.
- Export → import round trip changes nothing; text starting with `=` is exported as text.

## 9. Not in this plan

Hotel and room type import (they stay as in the app), importing several hotels in one file, deleting or renaming through Excel, CSV, import history, scheduled imports. Room types could be added later as a second sheet.

## 10. Questions for you

1. **Room type in the file:** is a **Room Type column with a dropdown** (my proposal, one file can mix room types) enough? The "download for one room type, only type numbers" shortcut is included as optional; say if you want it dropped.
2. **Existing rooms:** should re-uploading **update** them (my proposal, needs `edit-room`), or only add new rooms and skip existing numbers?
3. **Bad rows:** save the valid rows and report the rest (my proposal), or save nothing unless the whole file is clean?
4. Please confirm **§7a**: remove `floor`, `isSellable` and `notes` from the rooms collection (stored values are deleted), not only from the Excel.
