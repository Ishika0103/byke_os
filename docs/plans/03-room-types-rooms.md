# Plan 03: Room types & rooms

> Status: ✅ Approved and built (2026-11-21)
> Builds on Plan 02 (hotels). Same layering, envelope, soft-delete, migration and status-toggle patterns as hotels / roles / users.
> Room **status** (clean / dirty / out of order) is not a field here: it will come from tasks and task updates (Plan 05).

## 1. Goal

Each hotel gets its room types (Deluxe, Suite…) and its rooms (101, 102…), stored in MongoDB and managed from the app. Fields are chosen for what the Astara pilot deck needs: matching PMS data, real sellable inventory (availability-mismatch exception), cleaning time (arrival-room deadlines) and housekeeping routing by floor.

## 2. Data model

### `roomTypes`

```
roomTypes {
  _id,
  hotelId,
  name,              // "Deluxe Room"   unique per hotel (case-insensitive)
  code,              // "DLX"  generated from the name, unique per hotel, never changes
  pmsCode,           // optional: the room type code in Trustify PMS, for matching imported data
  cleaningMinutes,   // optional: standard cleaning time, 5–240
  isActive, isDeleted, createdBy, updatedBy, createdAt, updatedAt
}
```

- **No stored `noOfRooms`.** API responses include `roomCount` (non-deleted rooms of that type), so it can't drift.
- Code generation is the same as hotels ("Deluxe Room" → `DLX`, "Premium Suite" → `PS`, numbered if taken), skipping the word "Room".

### `rooms`

```
rooms {
  _id,
  hotelId,
  roomTypeId,        // same hotel; must be active when a room is added to / moved into it
  roomNumber,        // "101", "A-12"   1–10 chars [A-Z0-9-], uppercased, unique per hotel
  floor,             // optional integer -5…200 (housekeeping works by floor)
  isSellable,        // default true; false = staff / owner / store room, left out of inventory
  notes,             // optional, ≤ 500 chars, permanent note ("Geyser weak")
  isActive, isDeleted, createdBy, updatedBy, createdAt, updatedAt
}
```

Lists sort room numbers naturally (2 before 10).

### Indexes (one migration)

| Collection  | Indexes                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `roomTypes` | `{ hotelId, code }` unique; `{ hotelId, name }` unique, case-insensitive (both partial `isDeleted: false`) |
| `rooms`     | `{ hotelId, roomNumber }` unique (partial); `{ roomTypeId }`; `{ hotelId, floor }`                         |

## 3. Rules

| Rule                                                                                | Error                   |
| ----------------------------------------------------------------------------------- | ----------------------- |
| Hotel must exist (not deleted)                                                      | 404                     |
| Room type must belong to the same hotel, and be active to add / move a room into it | 400 on `roomTypeId`     |
| Room type **can't be made inactive or deleted while it has rooms**                  | 409 `ROOM_TYPE_IN_USE`  |
| Hotel **can't be deleted while it has room types or rooms**                         | 409 `HOTEL_IN_USE`      |
| Duplicate room number in the same hotel (also in bulk add: all-or-nothing)          | 409 `ROOM_NUMBER_TAKEN` |
| Duplicate room type name in the same hotel                                          | 409 `NAME_TAKEN`        |
| Same room number / type name in **different** hotels                                | allowed                 |

## 4. API

| Method           | Path                              | Body / query                                                                       |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| GET              | `/hotels/:hotelId/room-types`     | `q`, `isActive`, `page`, `limit`; each item has `roomCount`                        |
| POST             | `/hotels/:hotelId/room-types`     | `name`, `pmsCode?`, `cleaningMinutes?`, `isActive?`                                |
| GET/PATCH/DELETE | `/hotels/:hotelId/room-types/:id` | PATCH: `name`, `pmsCode`, `cleaningMinutes`, `isActive`                            |
| GET              | `/hotels/:hotelId/rooms`          | `q` (room number), `roomTypeId`, `floor`, `isActive`, `page`, `limit`              |
| POST             | `/hotels/:hotelId/rooms`          | `roomNumber`, `roomTypeId`, `floor?`, `isSellable?`, `notes?`, `isActive?`         |
| POST             | `/hotels/:hotelId/rooms/bulk`     | `from`, `to` (whole numbers, max 300 rooms), `roomTypeId`, `floor?`, `isSellable?` |
| GET/PATCH/DELETE | `/hotels/:hotelId/rooms/:id`      | PATCH: `roomNumber`, `roomTypeId`, `floor`, `isSellable`, `notes`, `isActive`      |

Rooms include `roomType: { id, name, code }`. Permissions: `authenticate` only for now.

## 5. App

The hotel's edit screen gets a **Rooms** section: _Room types (n)_ and _Rooms (n)_, opening screens for that hotel. Home's Property row shows the room count.

| Screen               | Contents                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Room types           | Search; rows "Deluxe Room · DLX · 20 rooms" + status pill; + to add                                           |
| Add / edit room type | Name, PMS code, cleaning minutes, status (add: plain switch; edit: with confirmation), delete                 |
| Rooms                | Search by number, room type filter (drawer); rows "101 · Deluxe Room · Floor 1" + status pill; add / bulk add |
| Add / edit room      | Room number, room type (drawer), floor, sellable switch, notes, status, delete                                |
| Add rooms in bulk    | From, To, room type, floor, sellable → "20 rooms will be added: 101–120" → Create                             |

## 6. Tests

Room types: generated code, duplicate name per hotel, same name in another hotel, `roomCount`, can't deactivate/delete with rooms, hotel must exist. Rooms: create, duplicate number per hotel, same number in another hotel, room type from another hotel / inactive, filters, natural sort, bulk create (all-or-nothing, max size), hotel delete blocked when it has rooms. Migration indexes.

## 7. Not in this plan

Room status (Plan 05 tasks), occupancy limits, bed type, rates, amenities, block / wing, PMS room-number mapping.
