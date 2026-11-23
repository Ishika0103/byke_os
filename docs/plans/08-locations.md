# Plan 08: Locations in the database

> Status: ✅ Built (2026-11-24), reduced scope: **database entries only**. No Locations screen, no add / edit / delete API and no location permissions for now (§5 and §6 below are postponed). Hotels store `locationId`; a read-only `GET /locations` feeds the hotel form's dropdown.
> Today a hotel's city and state come from a fixed list inside the code (`indian-cities.ts`, about 250 cities). This plan moves locations into the database, seeds them with Byke's own destinations, and makes hotels point to a location by id.

## 1. What changes

| Today                                                                   | After                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `hotels.location = { city, state }`, checked against a list in the code | `hotels.locationId` → a document in the new `locations` collection |
| The dropdown shows about 250 generic Indian cities                      | The dropdown shows **Byke's locations** from the database          |
| Adding a city = a code change and a deploy                              | Adding a location = a screen in the app (Super Admin)              |

## 2. New collection: `locations`

| Field                                                                       | Type   | Notes                                                   |
| --------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `name`                                                                      | String | 2–60 characters, unique ignoring case (e.g. `Matheran`) |
| `state`                                                                     | String | e.g. `Maharashtra`                                      |
| `isActive`, `isDeleted`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` |        | the usual fields                                        |

Index: `name` unique, case-insensitive, partial on `isDeleted:false`.

## 3. Starting data (inserted by a migration)

Source: **Byke’s own locations list** (19 locations from Byke become 21 here (Goa split in two, Borivali added by you), 30 hotels, as supplied by you). It has no states, so the **State** column is from general knowledge and still **needs your check**. Byke lists one "Goa" (id 28, 2 hotels); on your instruction it is split into **North Goa** (The Byke Royal Pearl, Anjuna) and **South Goa** (The Byke Old Anchor Beach Resort), so both share Byke id 28.

| Byke id | Location      | State          | Hotels |
| ------- | ------------- | -------------- | ------ |
| 1       | Mahabaleshwar | Maharashtra    | 2      |
| 2       | Bengaluru     | Karnataka      | 1      |
| 5       | Jaipur        | Rajasthan      | 2      |
| 6       | Junagadh      | Gujarat        | 1      |
| 7       | Kovalam       | Kerala         | 1      |
| 9       | Matheran      | Maharashtra    | 3      |
| 10      | Mumbai        | Maharashtra    | 1      |
| 11      | Ooty          | Tamil Nadu     | 1      |
| 13      | Thane         | Maharashtra    | 2      |
| 14      | Indore        | Madhya Pradesh | 3      |
| 18      | Ujjain        | Madhya Pradesh | 3      |
| 19      | Gurugram      | Haryana        | 1      |
| 20      | Palghar       | Maharashtra    | 1      |
| 21      | Bhopal        | Madhya Pradesh | 1      |
| 22      | Osian         | Rajasthan      | 1      |
| 23      | Nashik        | Maharashtra    | 2      |
| 24      | Surat         | Gujarat        | 1      |
| 26      | Kumbhalgarh   | Rajasthan      | 1      |
| 28      | North Goa     | Goa            | 1      |
| 28      | South Goa     | Goa            | 1      |
| –       | Borivali      | Maharashtra    | 0      |

Each location also keeps a `slug` (e.g. `matheran`, `north-goa`) and, where Byke has one (Borivali has none), its id as `bykeId` (North and South Goa both carry 28).

Also inserted: any location already used by hotels in the database (for example the test hotel's Hyderabad, Telangana), so no existing hotel loses its location.

The list is reference data, so it goes in a **migration** (CLAUDE.md). The migration holds its own copy of the list and doesn't depend on the code's city list.

## 4. Hotels

- `hotels.locationId` (ObjectId → locations, required).
- The API returns `location: { id, name, state }` on every hotel (filled in from the locations collection), so screens keep showing "Matheran, Maharashtra".
- **Create / edit hotel** takes `locationId` instead of `location: { city, state }`.
- **Hotel search** by city or state now looks the text up in `locations` first and matches hotels by `locationId`.
- A **location that hotels use can't be deleted** (409 `LOCATION_IN_USE`); it can be made inactive (it stays on its hotels but is no longer offered for new ones).

**Migration for existing hotels** (new file, applied once, with a working `down`):

1. Create `locations` and its index; insert the 21 above.
2. For each hotel, find the location whose name matches its old `location.city` (ignoring case); if none exists, insert one from the hotel's old city and state.
3. Set `hotel.locationId`; then remove the old `location` field and the `location_city` index; add an index on `locationId`.
4. `down` rebuilds `location: { city, state }` from the locations and drops `locationId`.

## 5. API

| Endpoint                | Permission                                   | Does                                                                    |
| ----------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /locations`        | `view-location`, `add-hotel` or `edit-hotel` | List (search, active filter, paging); used by the hotel form's dropdown |
| `POST /locations`       | `add-location`                               | Create                                                                  |
| `GET /locations/:id`    | `view-location`                              | One                                                                     |
| `PATCH /locations/:id`  | `edit-location`                              | Rename, change state, active / inactive                                 |
| `DELETE /locations/:id` | `delete-location`                            | Soft delete (blocked while hotels use it)                               |

Four new permission names join the catalogue as a **Locations** row in the Permissions grid: `view-location`, `add-location`, `edit-location`, `delete-location`. Super Admin holds them through `*`; other roles start without them.

The shared `indian-cities.ts` list and its checks are removed from the app and API once nothing uses them.

## 6. App

- **Hotel form:** the Location field loads from `GET /locations` (searchable, active locations, plus the hotel's current one even if inactive). It shows "Matheran, Maharashtra".
- **Settings → Locations** (visible with `view-location`): a list with search, **Add location** (name + state), edit, active / inactive, delete. The same layout as the Roles and Hotels screens.
- New `features/locations` (api, hooks, components) and screens under `app/(app)/locations/`.

## 7. Effect on the Excel plan (Plan 07)

The Hotels sheet's **City** and **State** columns become one **Location** column: a dropdown of the location names from the database. The state is looked up automatically. An unknown location is rejected with a clear message ("Location 'Xyz' is not in the list. Add it under Settings → Locations first"). The sample file and export use the live location list.

## 8. Tests

- Migration: 21 locations inserted; existing hotels get the right `locationId`, including a hotel with a city outside the seeded list; `down` restores `location`.
- Locations CRUD, validation, duplicate names (ignoring case), soft delete, `LOCATION_IN_USE`.
- Hotels: create and edit with `locationId`; unknown, deleted or inactive location rejected (inactive allowed to stay on an existing hotel); hotel responses include `location`; search by location name.
- Permissions matrix extended with the location routes.

## 9. Not in this plan

Pincode, address, latitude / longitude, or a country / region hierarchy; showing the properties under each location; syncing automatically with thebyke.com.

## 10. Questions for you

1. ~~Goa~~: settled, split into **North Goa** and **South Goa**.
2. **The 19 states** in §3 are my knowledge, not from the site. Are they right?
3. **Is the list complete?** The site says "over 25 properties across 20 cities". If you have the full list (or a hotel list), send it and I'll add the missing locations.
4. Should I include the **Settings → Locations** screen (so new locations can be added in the app) as in §6, or only the seeded list for now?
