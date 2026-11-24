# CLAUDE.md

Guidance for Claude (and humans) working in this repository.

## What Byke OS is

Byke OS is the **operating system for Byke hotel properties**. A property's results today depend on how proactive its GM is. Byke OS makes routine operations run correctly even when the GM is unavailable, new or less proactive:

- **Source data flags exceptions** (housekeeping, revenue, consumption, guest issues…) instead of someone having to notice them.
- **Rules show the next action and deadline**, and **work routes to the responsible HOD**.
- **Closure requires evidence** or supervisor verification.
- **GM / Unit Head** gets a daily priority list. **HO (Head Office)** sees property health, exceptions, owners and pending time across all properties.
- Six work areas: Demand & revenue · Guest delivery · Asset readiness · Materials & vendors · People · Money & control.

**First pilot:** Astara property, live **2026-11-23**. Background deck: `BYKE OS _ Astara Pilot.pdf`.

## Stack & layout

npm-workspaces monorepo (Node ≥ 22):

| Path              | What                                                  | Tech                                               |
| ----------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `apps/mobile`     | One app for Android, iOS **and Web**                  | Expo SDK 58, React Native, Expo Router, TypeScript |
| `apps/api`        | REST API at `/api/v1`                                 | Express 5, Mongoose, Zod, Pino                     |
| `packages/shared` | Types, Zod schemas, permission catalogue used by both | TypeScript + Zod                                   |
| `docs/plans/`     | Implementation plans, one per feature                 | Markdown                                           |

MongoDB runs in Docker (`docker-compose.yml`, container `byke-os-mongo`, `mongodb://127.0.0.1:27017/byke_os`). View it with MongoDB Compass.

## Commands (run from repo root)

```bash
npm run db:up            # start MongoDB (Docker Desktop must be running)
npm run dev              # API (:4000) + Expo dev server (press w / a / i)
npm run lint             # ESLint, all workspaces
npm run typecheck        # tsc, all workspaces
npm test                 # API tests (Vitest + Supertest)
npm run build            # build shared + api
npm run format           # Prettier
```

`packages/shared` must be built before the API/app can see changes (`npm run build -w @byke-os/shared`; also runs on `npm install`).

## Working rules for Claude

1. **Plan first, code after approval.** For any new module, schema change or cross-cutting change, write or update a plan in `docs/plans/NN-<name>.md` and wait for explicit approval before writing code. Small bug fixes don't need a plan.
2. **Keep it simple.** The data model will keep changing. Build only what the current plan asks for, and don't add speculative abstractions, libraries or fields.
3. **Done means green:** run `npm run lint`, `npm run typecheck` and `npm test` before saying a task is complete, and report failures honestly.
4. **Mobile specifics:** follow `apps/mobile/AGENTS.md`. Add packages with `npx expo install <pkg>` inside `apps/mobile`, and check the **SDK 58** versioned Expo docs instead of relying on memory.
5. **Git:** don't commit or push unless asked. Never commit `.env` files, only `.env.example`. Conventional Commits (`feat:`, `fix:`, `chore:`…).
6. Ask when a business rule is unclear (who can do what, which department owns what). Don't guess hotel-operations logic.

## Architecture conventions

### API (`apps/api/src`)

- **One folder per feature in `modules/<feature>/`**, layered:
  `*.routes.ts` (URLs + middleware) → `*.controller.ts` (HTTP in/out only) → `*.service.ts` (business rules) → `*.model.ts` (Mongoose schema).
  Controllers never touch models; services never touch `req`/`res`.
- Mount each module's router in `src/routes.ts`.
- Validate request bodies with Zod schemas from `@byke-os/shared` via `validateBody(schema)`.
- Throw `AppError.badRequest / notFound / conflict…`; never send error responses by hand. `middlewares/error-handler.ts` formats everything.
- Every response uses the envelope `{ success: true, data }` / `{ success: false, error: { code, message, details? } }`; use `ok(res, data)`.
- Express 5 forwards async errors automatically, so no try/catch in controllers.
- Config only through `config/env.ts` (validated). Add new env vars there **and** to `.env.example`.

### App (`apps/mobile/src`)

- `app/`: screens/routes only, kept thin.
- `features/<feature>/`: `api/`, `hooks/`, `components/` and an `index.ts` public entry. Import features only via `@/features/<feature>`.
  Feature names mirror the API modules.
- `components/`, `hooks/`: only code shared by several features.
- `lib/api-client.ts` is the only place that calls `fetch`.
- `EXPO_PUBLIC_*` env vars are bundled into the app, so never put secrets in them.

### Shared (`packages/shared`)

- Every entity's Zod schema and TS types live here and are used by **both** API and app. Never duplicate a type on one side.

### Data conventions (MongoDB)

- Every collection has `isActive`, `isDeleted`, `createdAt`, `updatedAt` (and `createdBy` / `updatedBy` once Plan 01 lands).
  - `isActive: false` = disabled but visible to admins. `isDeleted: true` = soft-deleted, hidden everywhere. **Never hard-delete business data.**
- Collection names all-lowercase plural (`users`, `roomtypes`, `taskmasters`). API exposes `id` (not `_id`) and no `__v`.
- Hotel-owned resources are nested under `/hotels/:hotelId/...` and always carry `hotelId`.
- Unique indexes are partial on `isDeleted: false`.
- **Every database change goes through a migration** in `apps/api/src/db/migrations/` (umzug): indexes, field renames, backfills, reference data such as system roles. See Plan 01 §0.1.
  - Never edit a migration that has already run; add a new one. Each has `up()` and `down()`.
  - Migrations use the raw driver (`db.collection(...)`), not Mongoose models.
  - Indexes are created by migrations; Mongoose `autoIndex` is development-only.
  - Environment-specific or demo data (first admin, sample users) goes in the **seed** script, not in migrations.

### Access control (target state, see Plan 01)

- Every route except `/health` and `/auth/login|refresh` must `authenticate` and `authorize('<resource>:<action>')`.
- **Check permissions, never role names.** The catalogue (named permissions such as `add-hotel`) lives in `packages/shared/src/rbac/permissions.ts`; each role stores its list in `roles.permissions` (Plan 06). Routes use `authorize('add-hotel')`; the app uses `usePermission` / `<Can>`.
- Hotel-owned data must go through the hotel-scope check; list queries are filtered to the user's hotels.
- Hiding UI in the app (`<Can>`, `usePermission`) is UX only. The API is the security boundary.

## Plans & status

| Plan                                                                                                                                                                                                                                                   | Status                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [`docs/plans/01-rbac.md`](docs/plans/01-rbac.md): Authentication & RBAC (roles, users, hotels, hotel-user mapping, room types, rooms)                                                                                                                  | Part A (login, roles CRUD, users CRUD): ✅ done (API + app login) · Part B (permissions): ⏸️ on hold |
| [`docs/plans/01a-schemas-validation-security.md`](docs/plans/01a-schemas-validation-security.md): exact schemas, validation layers, auth flows, security checklist (source of truth for field lists)                                                   | 📝 Draft, awaiting approval                                                                          |
| [`docs/plans/02-hotels.md`](docs/plans/02-hotels.md): Hotels master data + CRUD (name, code, location from Indian city list, check-in/out times)                                                                                                       | ✅ done (API + app)                                                                                  |
| [`docs/plans/03-room-types-rooms.md`](docs/plans/03-room-types-rooms.md): Room types & rooms per hotel (generated codes, room counts, floor, bulk add)                                                                                                 | ✅ done (API + app)                                                                                  |
| [`docs/plans/04-tasks.md`](docs/plans/04-tasks.md): Generic tasks + append-only task updates (stages, proof, verification, progress bar, timeline); 3 fixed departments                                                                                | ✅ done (API + app)                                                                                  |
| [`docs/plans/05-user-hotels.md`](docs/plans/05-user-hotels.md): Users mapped to hotels (multi-select), API scoped to the user's hotels                                                                                                                 | 📝 Draft, awaiting approval                                                                          |
| [`docs/plans/06-permissions.md`](docs/plans/06-permissions.md): Named role permissions (add-user, edit-hotel…) stored on the role, checked on every route, permission grid in the app                                                                  | ✅ done (API + app)                                                                                  |
| [`docs/plans/07-excel-onboarding.md`](docs/plans/07-excel-onboarding.md): Rooms onboarding by Excel, per hotel: sample download, upload, preview, confirm; import + export of rooms (Hotel Code + Room Type Code columns)                              | ✅ done (API + app)                                                                                  |
| [`docs/plans/08-locations.md`](docs/plans/08-locations.md): Locations collection seeded from Byke's list; hotels store `locationId`; read-only API, no screens yet                                                                                     | ✅ done (DB + API + hotel dropdown; screens postponed)                                               |
| [`docs/plans/09-departments-task-flow.md`](docs/plans/09-departments-task-flow.md): Home / + menu cleanups, mobile number, import speed, Department master, task masters + new task flow (multi rooms, multi users), notifications, email verification | ✅ done except email verification (postponed) and push (later)                                       |
| [`docs/plans/10-ho-overview-gap.md`](docs/plans/10-ho-overview-gap.md): what the "BYKE HO App Overview" asks for vs what is built (alerts, GM Today, HO health, roles per property, rules and feeds)                                                   | 📝 Draft, awaiting approval                                                                          |
| [`docs/plans/11-s3-uploads.md`](docs/plans/11-s3-uploads.md): proof photos and uploaded Excel files go to AWS S3 (`STORAGE_DRIVER=s3`)                                                                                                                 | ✅ done (needs bucket setup on Render)                                                               |
| [`docs/plans/12-consumption.md`](docs/plans/12-consumption.md): Consumption module: daily Issue / Consumption flags per property and module, synced from a hardcoded Google Sheet; module master                                                       | ✅ done (API + app); sheet needs a Property Code column                                              |

Expected next: tasks engine (Plan 04) → departments & HOD routing → GM daily priority list → HO property-health dashboard.
