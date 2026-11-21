# Plan 01a — Schemas, Validation, Authentication & Security

> **Status:** 📝 Draft, awaiting approval · **Created:** 2026-11-20 · **Revised:** 2026-11-20 (simplified: no `isSystem`, minimal user fields, stateless JWT)
> Companion to [`01-rbac.md`](01-rbac.md). Where field lists differ, **this document wins**.
> Scope: **Part A** (roles, users, login) in full detail; master-data collections as a **draft** for the next plan.

---

## 1. Conventions for every collection

| Field                    | Type                     | Default    | Notes                                                 |
| ------------------------ | ------------------------ | ---------- | ----------------------------------------------------- |
| `_id`                    | ObjectId                 | auto       | Exposed by the API as `id` (string)                   |
| `isActive`               | Boolean                  | `true`     | `false` = disabled, still visible to admins           |
| `isDeleted`              | Boolean                  | `false`    | `true` = soft-deleted, hidden from all normal queries |
| `createdBy`              | ObjectId → users \| null | from login | `null` only for migration / seed records              |
| `updatedBy`              | ObjectId → users \| null | from login | Updated on every change (including soft delete)       |
| `createdAt`, `updatedAt` | Date                     | auto       | Mongoose `timestamps`                                 |

- Added once via a **base-fields plugin**; queries exclude `isDeleted: true` automatically.
- **Soft delete** sets `isDeleted: true`; `updatedAt` (automatic) and `updatedBy` record when and by whom. There is no separate `deletedAt` field.
- Clients can **never** set `_id`, `isDeleted`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` directly.
- API responses never include `__v`; `_id` becomes `id`.
- Unique indexes are **partial** (`isDeleted: false`), so a deleted record's email or code can be reused.
- The `migrations` collection (managed by umzug) does not use these fields.

---

## 2. Part A collections

### 2.1 `roles`

| Field             | Type     | Required | Validation                          | Notes                                                               |
| ----------------- | -------- | :------: | ----------------------------------- | ------------------------------------------------------------------- |
| `name`            | String   |    ✅    | trim, 2–50 chars                    | Display label, e.g. "General Manager". Unique, **case-insensitive** |
| `code`            | String   |    ✅    | uppercase, `^[A-Z][A-Z0-9_]{1,29}$` | Stable key, e.g. `GM`. Unique. **Cannot be changed after creation** |
| _common fields_   |          |          |                                     | §1                                                                  |
| ~~`permissions`~~ | [String] |          |                                     | ⏸️ Added in Part B                                                  |

**Indexes**

- `{ code: 1 }` unique, partial `isDeleted: false`
- `{ name: 1 }` unique, partial `isDeleted: false`, collation `{ locale: 'en', strength: 2 }` (case-insensitive)

**Business rules (service layer)**

- A role assigned to any non-deleted user can't be deleted or deactivated. Reassign those users first (→ `409 ROLE_IN_USE`).
  This also protects `SUPER_ADMIN`, which always has at least one user.
- Deactivated roles can't be assigned to users.

**Example**

```json
{
  "id": "6740a1…",
  "name": "General Manager",
  "code": "GM",
  "isActive": true,
  "createdAt": "2026-11-20T10:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

### 2.2 `users`

| Field           | Type             | Required | Validation                                | Notes                               |
| --------------- | ---------------- | :------: | ----------------------------------------- | ----------------------------------- |
| `name`          | String           |    ✅    | trim, 2–80 chars, no control characters   |                                     |
| `email`         | String           |    ✅    | trim, **lowercase**, valid email, max 254 | Login ID. Unique                    |
| `roleId`        | ObjectId → roles |    ✅    | must exist, be active and not deleted     | One global role per user            |
| `hashPassword`  | String           |    ✅    | bcrypt hash                               | `select: false`, **never returned** |
| _common fields_ |                  |          |                                           | §1                                  |

**Indexes**

- `{ email: 1 }` unique, partial `isDeleted: false`
- `{ roleId: 1 }`, used for "is this role in use?" and filtering

**Business rules (service layer)**

- Email must be unique among non-deleted users (`409 EMAIL_TAKEN`).
- A user can't deactivate, delete or change the role of **themselves**.
- The **last active user with role `SUPER_ADMIN`** can't be deactivated, deleted or moved to another role (prevents lockout).
- The password is **never** set via `PATCH /users/:id`; only via `POST /users` (initial), `POST /users/:id/reset-password` (admin) or `POST /auth/change-password` (self).

**Example response** (no sensitive fields)

```json
{
  "id": "6740b2…",
  "name": "Ravi Kumar",
  "email": "ravi@thebyke.com",
  "role": { "id": "6740a1…", "name": "General Manager", "code": "GM" },
  "isActive": true,
  "createdAt": "2026-11-18T06:00:00.000Z",
  "updatedAt": "2026-11-20T09:12:00.000Z"
}
```

### 2.3 `migrations` (managed by umzug)

`{ name: String, migratedAt: Date }`. Never edited by hand.

---

## 3. Master-data collections — draft for the next plan

> Shown so the whole model is visible. **Not built in Part A.** Final shape is decided in the master-data plan.

| Collection   | Fields (+ common fields)               | Key validation                                                                          | Indexes                                                      |
| ------------ | -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `hotels`     | `name`, `code`                         | name 2–100; code uppercase `^[A-Z0-9]{2,10}$`, immutable                                | `code` unique (partial)                                      |
| `hotelUsers` | `hotelId`, `userId`                    | both must exist and be active                                                           | `{ hotelId, userId }` unique (partial); `{ userId }`         |
| `roomTypes`  | `hotelId`, `name`, `code`, `noOfRooms` | code `^[A-Z0-9_]{2,20}$`; `noOfRooms` integer ≥ 0                                       | `{ hotelId, code }` unique (partial)                         |
| `rooms`      | `hotelId`, `roomTypeId`, `roomNumber`  | `roomNumber` **string** 1–10 `^[A-Za-z0-9-]+$`; room type must belong to the same hotel | `{ hotelId, roomNumber }` unique (partial); `{ roomTypeId }` |

---

## 4. Validation: four layers

Each layer has a different job. Together they make bad data impossible, not just unlikely.

| #   | Layer                    | Where                                                     | Job                                                                                            | Example                                                           |
| --- | ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | **Request validation**   | Zod schemas in `packages/shared`, run by `validateBody()` | Shape, types, formats, lengths; trims and lowercases; **rejects unknown fields** (`.strict()`) | `email` must be a valid email; `hashPassword` in the body → 400   |
| 2   | **Business rules**       | `*.service.ts`                                            | Rules that need the database or context                                                        | Email already used; role in use; can't delete yourself            |
| 3   | **Model validation**     | Mongoose schema                                           | Last safety net if code bypasses layer 1                                                       | `required`, `enum`, `maxlength`                                   |
| 4   | **Database constraints** | Indexes (via migrations)                                  | Guarantees under race conditions                                                               | Two simultaneous signups with the same email → one fails with 409 |

- The **app reuses the same Zod schemas** for its forms, so users see errors instantly. The API still re-validates everything.
- Path params: `:id` must be a valid ObjectId → `400`.
- List endpoints accept only whitelisted query params:
  `page` (≥ 1), `limit` (1–100, default 20), `q` (search name/email, max 100 chars, **regex-escaped**), `isActive`, `roleId`, `sort` (whitelist: `name`, `createdAt`, `-createdAt`…).

### Request schemas (Part A)

| Endpoint                         | Body                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| `POST /auth/login`               | `email`, `password` (1–72)                                        |
| `POST /auth/refresh`             | `refreshToken`                                                    |
| `POST /auth/change-password`     | `currentPassword`, `newPassword` (password policy)                |
| `POST /roles`                    | `name`, `code`                                                    |
| `PATCH /roles/:id`               | `name?`, `isActive?` (never `code`)                               |
| `POST /users`                    | `name`, `email`, `roleId`, `password` (password policy)           |
| `PATCH /users/:id`               | `name?`, `email?`, `roleId?`, `isActive?` (never password fields) |
| `POST /users/:id/reset-password` | `newPassword` (password policy)                                   |

### Error responses

| HTTP | `error.code`                                 | When                                                     |
| ---- | -------------------------------------------- | -------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                           | Body / params / query invalid (`details` lists fields)   |
| 401  | `UNAUTHENTICATED`                            | Missing, invalid or expired token; wrong email/password  |
| 403  | `ACCOUNT_DISABLED`                           | Correct password, but the user is deactivated            |
| 403  | `FORBIDDEN`                                  | Business rule blocks the action (e.g. deleting yourself) |
| 404  | `NOT_FOUND`                                  | Record doesn't exist (or is soft-deleted)                |
| 409  | `EMAIL_TAKEN` / `CODE_TAKEN` / `ROLE_IN_USE` | Conflicts                                                |
| 429  | `TOO_MANY_REQUESTS`                          | Rate limit hit                                           |

---

## 5. Authentication (JWT, stateless)

No session collection: the server stores **no token data**. Both tokens are signed JWTs.

### 5.1 Tokens

|          | **Access token**                                                                       | **Refresh token**                                             |
| -------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Format   | JWT, `HS256` (algorithm pinned when verifying)                                         | JWT, `HS256`, **different secret**                            |
| Lifetime | **15 minutes**                                                                         | **7 days**                                                    |
| Claims   | `sub` (userId), `type: "access"`, `iat`, `exp`, `iss: byke-os-api`, `aud: byke-os-app` | `sub` (userId), `type: "refresh"`, `iat`, `exp`, `iss`, `aud` |
| Never in | Name, email, role or anything else personal (JWTs are readable by anyone)              | Same                                                          |
| Sent as  | `Authorization: Bearer <token>`                                                        | Request body to `/auth/refresh`                               |

The `type` claim plus separate secrets ensure a refresh token can't be used as an access token, or the other way round.

### 5.2 Login flow — `POST /auth/login`

```
1. Rate limit: 10 / 15 min per IP, 5 / 15 min per email                → 429
2. Validate body (Zod)                                                  → 400
3. Find non-deleted user by email (+ hashPassword)
4. User not found → still run bcrypt.compare against a dummy hash
   (same response time, so attackers can't tell which emails exist)     → 401 "Invalid email or password"
5. Wrong password                                                       → 401 (same generic message)
6. Correct password, but isActive = false                               → 403 ACCOUNT_DISABLED
7. Success → return { accessToken, refreshToken, user }
```

### 5.3 Refresh flow — `POST /auth/refresh`

```
1. Verify refresh JWT (signature, exp, iss, aud, type = "refresh")      → 401
2. Load user: must exist, not deleted, active                           → 401 / 403
3. Return a new { accessToken, refreshToken }
```

### 5.4 Other auth endpoints

- `GET /auth/me`: current user + role (Part B adds permissions and hotels).
- `POST /auth/change-password`: requires `currentPassword`.
- **Logout** happens in the app: it deletes both tokens from the device. (There's no server-side logout, because the server stores no tokens.)

### 5.5 `authenticate` middleware (every protected route)

```
1. Read "Authorization: Bearer <token>"                        → 401 if missing
2. Verify signature, exp, iss, aud, type = "access" (HS256)    → 401
3. Load user: must exist, not deleted, active                  → 401 / 403 ACCOUNT_DISABLED
4. req.auth = { userId, roleId }  (used for createdBy / updatedBy and business rules)
```

Step 3 loads the user on **every request**, so deactivating or deleting a user locks them out **immediately**, even though their tokens haven't expired.

### 5.6 Passwords

| Rule        | Value                                                        | Why                                                                     |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Hashing     | `bcryptjs`, cost factor **12**                               | Slow by design; pure JS (no native build issues)                        |
| Length      | **8–72** characters                                          | bcrypt ignores everything after 72 bytes                                |
| Composition | at least one letter and one number; must not equal the email | Simple, readable policy; follows NIST guidance (length over complexity) |

### 5.7 First Super Admin

`npm run seed` reads `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` from `apps/api/.env`. It creates the user only if no user with role `SUPER_ADMIN` exists, so it's safe to re-run.

### 5.8 Known limitations of stateless JWT (accepted for now)

| Limitation                                                                                              | Impact                                              | Fix when needed                                               |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| After logout or a password change, a **copied** refresh token keeps working until it expires (≤ 7 days) | Only matters if a token is stolen                   | Add a token version field on `users`, or a revoked-token list |
| Can't "log out all devices" from the server                                                             | Admin can't end a specific user's sessions          | Same as above                                                 |
| Disabled / deleted users                                                                                | **Not affected**: blocked immediately (§5.5 step 3) | —                                                             |

---

## 6. Security checklist

### API

| Risk                                                               | Protection                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Brute-force login                                                  | Rate limits per IP (10 / 15 min) and per email (5 / 15 min)                                                                        |
| Account enumeration                                                | Same message and timing for unknown email / wrong password                                                                         |
| Token tampering / confusion                                        | HMAC signature, algorithm pinned to HS256, `iss` / `aud` / `type` checked, separate secrets ≥ 32 chars (validated at startup)      |
| NoSQL injection (`{ "$gt": "" }` in a field)                       | Zod accepts only expected primitives; Mongoose `sanitizeFilter: true` globally; request data is never passed straight into queries |
| Regex attacks via search                                           | Search text is escaped before use in `$regex`, max 100 chars                                                                       |
| Mass assignment (`hashPassword`, `createdBy`, `isDeleted` in body) | Zod `.strict()` allowlists; services set these fields themselves                                                                   |
| Leaking sensitive fields                                           | `select: false` + `toJSON` transform removes `hashPassword` and `__v`                                                              |
| Leaking internals in errors                                        | Generic 500 message in production; stack traces only in logs                                                                       |
| Secrets in logs                                                    | Pino `redact`: `authorization` header, `password*`, `*Token`, `cookie`                                                             |
| Secrets in Git                                                     | Only `.env.example` is committed; env validated at startup                                                                         |
| Cross-site requests                                                | CORS allowlist (`CORS_ORIGINS`); Helmet security headers                                                                           |
| Large / malformed bodies                                           | 1 MB JSON limit; malformed JSON → 400                                                                                              |
| Traffic interception                                               | HTTPS in production (TLS at host / proxy) + HSTS via Helmet                                                                        |
| Vulnerable dependencies                                            | `npm audit --omit=dev` in CI (fails on high/critical)                                                                              |
| Accountability                                                     | `createdBy` / `updatedBy` / `updatedAt` on every record (a soft delete updates them)                                               |

### App (Android / iOS / Web)

| Item                  | Approach                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Token storage (phone) | Access token **in memory only**; refresh token in `expo-secure-store` (encrypted Keychain / Keystore)                        |
| Token storage (web)   | Access token **in memory only**; refresh token in browser storage for the pilot ⚠️ → move to an `httpOnly` cookie in Phase 6 |
| Expired access token  | `api-client` refreshes once on 401, retries the request; if refresh fails → log out                                          |
| Logout                | Clears all stored tokens on the device                                                                                       |
| Validation            | Same Zod schemas as the API, for instant form errors                                                                         |
| Never                 | Log tokens, put secrets in `EXPO_PUBLIC_*`, or rely on hidden buttons for security                                           |

---

## 7. Environment variables (new)

| Variable                                                       | Example         | Rule                                                       |
| -------------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| `JWT_ACCESS_SECRET`                                            | random 64 chars | Required, ≥ 32 chars, unique per environment               |
| `JWT_REFRESH_SECRET`                                           | random 64 chars | Required, ≥ 32 chars, **different** from the access secret |
| `JWT_ACCESS_TTL`                                               | `15m`           |                                                            |
| `JWT_REFRESH_TTL`                                              | `7d`            |                                                            |
| `BCRYPT_COST`                                                  | `12`            | 10–14                                                      |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` |                 | Used only by `npm run seed`                                |

---

## 8. Revision log

| Date       | Change                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-20 | First draft: `sessions` collection, opaque refresh tokens, lockout fields, `mustChangePassword`                                                                                                                                                                |
| 2026-11-20 | **Simplified (owner decision):** removed `roles.isSystem`; users keep only `name`, `email`, `roleId`, `hashPassword` + common fields; stateless JWT (access + refresh), no `sessions` collection; lockout replaced by rate limiting; no forced password change |
| 2026-11-20 | Removed `deletedAt` from all collections (owner decision): soft delete = `isDeleted: true` + automatic `updatedAt` + `updatedBy`. Migration `remove-deleted-at` removes it from existing data                                                                  |
