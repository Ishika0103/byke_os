# Plan 12: Consumption module

> Status: ✅ Built (2026-11-24). **Decision (2026-11-25): only the sheet's Consumption column is used (its Issue columns are hidden), so there is no `type` field; one row per property + date + module** (migration `consumptions-drop-type`). Home shows a "Consumption today" section; tapping a module opens a month calendar, tapping a day opens that day. The live sheet still needs a Property Code column. Later: a scheduler that runs the sync, with a log of runs and old → new values.
> Source: Google Sheet "consumption" (tab `gid=1370813837`) and the **consumption module master** list from the team: F&B, Engineering, Housekeeping, Electricity, Water, Fuel.

## 1. What it is

A daily check, per **property**, per **day**, per **consumption module**: was the **Issue** marked, and was the **Consumption** marked. The sheet shows this as **0 or 1**, and we store it the same way (`isMarked` flags, 0 / 1). Data is **parsed from the sheet and saved to the database**. If a row for that property, date and module **already exists it is updated**, otherwise it is created. No `userId` on the data (the usual `createdBy` / `updatedBy` audit fields stay).

The modules come from the master `consumptionmodulemasters`. It is **not** the `departments` collection.

**What is "Issue"?** I can't tell this from the sheet: it only holds 0 and 1 under "Issue" and "Consumption". My reading: **1 = marked (filled in), 0 = not marked** for that property, day and module, so the sheet shows who has and hasn't marked. The plan stores exactly the sheet's 0/1 and does not interpret it further. Please confirm or correct this (§2, question 1).

## 2. Open questions

1. **Meaning of Issue / Consumption and the 0/1:** is 1 "marked / done" and 0 "not marked"? Or is Issue = 1 "an issue exists"? The field names below assume "marked".
2. **Electricity, Water, Fuel:** do they also have an Issue and a Consumption column in the sheet, like F&B / Engineering / Housekeeping?
3. **Year:** the sheet shows `17-Nov` with no year. Proposal: use the **current year**, unless the sheet's date cell is a real date.
4. **Sheet layout:** it will now carry a **Property Code** column. Is it still the wide layout (one block per day), as the sheet is today? The parser is written for that layout.
5. **Sheet sharing:** reading the sheet by link only works while it is shared as **"anyone with the link can view"** (it is today). If it is made private, we need a Google service account.

## 3. DB schema

### 3.1 `consumptionmodulemasters` (the six modules, seeded by migration)

| Field        | Type   | Notes                                                                           |
| ------------ | ------ | ------------------------------------------------------------------------------- |
| `name`       | String | F&B, Engineering, Housekeeping, Electricity, Water, Fuel. Unique, ignoring case |
| `code`       | String | `FB`, `ENG`, `HK`, `ELEC`, `WATER`, `FUEL`. Unique                              |
| `sortOrder`  | Number | Column order on screens: 1 to 6                                                 |
| usual fields |        | `isActive`, `isDeleted`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`     |

Indexes (partial on `isDeleted: false`): `name` unique (case-insensitive), `code` unique.

### 3.2 `consumptions` (one document = one property, one date, one module)

| Field          | Type              | Notes                                                                                        |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `hotelId`      | ObjectId → hotels | Found from the sheet's **Property Code**. Required                                           |
| `propertyCode` | String            | The code as in the sheet (readable in Compass)                                               |
| `date`         | Date              | The day, stored as **00:00 UTC** of that calendar date. Required                             |
| `module`       | String            | The module **code** (`FB`, `ENG`, `HK`, `ELEC`, `WATER`, `FUEL`). No `moduleId`              |
| `isMarked`     | Number (0 or 1)   | **0 = not marked, 1 = marked**, exactly the sheet's value                                    |
| usual fields   |                   | `isActive`, `isDeleted`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`. **No `userId`** |

Removed from the earlier draft: `moduleId`, `cluster`, `incharge`, `importFileUrl`, `importFileName`.

Indexes (migration, partial on `isDeleted: false`):

- `{ hotelId: 1, date: 1, module: 1 }` **unique**. This is what makes "same property, date and module again → update".
- `{ date: -1, hotelId: 1 }` for the all-properties view of one day.

Example (Astara, 17 Nov, F&B):

```json
{
  "hotelId": "6b01…",
  "propertyCode": "AST",
  "date": "2026-11-17T00:00:00.000Z",
  "module": "FB",
  "isMarked": 1,
  "isActive": true,
  "isDeleted": false,
  "createdBy": null,
  "updatedBy": null
}
```

## 4. Source and sync (parse → save)

- **The sheet link is hardcoded** in the code (a constant in the consumption module): the Google Sheet's CSV export address for the `consumption` tab. There is no file upload, so **nothing is stored in S3** for this module.
- A **Sync** action (button in the app, and the API behind it) downloads the sheet, parses it and saves it. It can also be called on a schedule later.
- **Parse:** read the wide layout into rows of `{ propertyCode, date, module, isMarked }`. A sheet with 24 properties × 7 days × 6 modules becomes 1,008 rows. A cell that is not 0 or 1 makes that row rejected.
- **Validate each row:** the property code exists in `hotels`; the module is in the master; the date is valid; the values are 0 or 1. Valid rows are saved, bad rows are reported with their row number and reason.
- **Upsert:** one `bulkWrite` with `updateOne({ hotelId, date, module }, { $set: … }, { upsert: true })`: **updated if it exists, created if not**. Rows identical to what is stored count as **unchanged**.
- Syncing again with the same sheet changes nothing. The result shows New / Updated / Unchanged / Rejected, so we can also offer a preview step before saving, as rooms does.

## 5. API (`/api/v1`)

| Method and path                             | Permission         | Does                                                                                                                     |
| ------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /consumption-modules`                  | `view-consumption` | The six modules in order (read-only master)                                                                              |
| `POST /consumption/sync`                    | `add-consumption`  | Reads the hardcoded sheet, upserts, returns new / updated / unchanged / rejected (with `?preview=true` it saves nothing) |
| `GET /consumption?date=&hotelId=&from=&to=` | `view-consumption` | Rows for the user's hotels, paged                                                                                        |
| `GET /consumption/summary?date=`            | `view-consumption` | One day, every property by module, plus the **Total** row (like the sheet's bottom)                                      |

Reads are filtered to the user's hotels (`req.auth.hotelIds`). The sync reads the whole sheet; rows for properties the user does not have are rejected as "not your property" unless the user can see all hotels (Super Admin).

New permission module **Consumption** (`view-consumption`, `add-consumption`, `edit-consumption`, `delete-consumption`) so it appears in the Permissions grid. Edit and delete have no screen yet.

## 6. Code layout

- `packages/shared/src/schemas/consumption.ts`: Zod schemas and types.
- `apps/api/src/modules/consumption-modules/`: read-only master list.
- `apps/api/src/modules/consumption/`: routes, controller, service, model, and `consumption-sync.service.ts` (download, parse, validate, upsert). The sheet link is a constant here.
- Migrations (raw driver): `…create-consumptionmodulemasters.ts` (collection, indexes, **seed the six modules**, idempotent) and `…create-consumptions.ts` (collection, the two indexes). Each has `down()`.
- App: `features/consumption/` and screens under `app/(app)/consumption/`: a **Sync** button with the result, and a **day view**. Entry from Settings → Consumption, gated by permission.

## 7. Screens (second step)

- **Sync:** one button, shows New / Updated / Unchanged / Rejected and the rejected rows with reasons.
- **Day view:** date picker; properties down the side, the six modules across (Consumption as ✓ / ✗ / –), and the **Total** row; tap a property for its last 7 days.

## 8. Tests

- Migrations: master seeded with the six modules (idempotent); indexes exist; `down()` works.
- Sync (the sheet download is faked with a sample CSV in the tests): new rows created; same data again → unchanged; changed 0/1 → updated with **no duplicate row** for the same property, date and module; rejected with row numbers for an unknown property code, an unknown module, a bad date or a value that is not 0 or 1; a sheet that cannot be downloaded gives a clear error and saves nothing.
- Permissions: no `add-consumption` → 403; a user only sees their own hotels' rows.
- Summary: totals equal the sum of the rows, per module.

## 9. Order of work

1. Migrations (master + seed, consumptions), models, shared schemas, permission row.
2. Sync (download, parse, validate, upsert) with tests.
3. List, summary and module-list endpoints.
4. App: Sync screen, then day view.
5. Browser check of each screen.

Nothing is built until the open questions in §2 are answered and the plan is approved.
