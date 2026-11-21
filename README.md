# Byke OS

Cross-platform app (**iOS · Android · Web** from one React Native codebase) backed by a **Node.js + Express** REST API and **MongoDB**.

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| App      | React Native, Expo SDK 58, Expo Router, TypeScript, react-native-web |
| API      | Node.js 22+, Express 5, Mongoose, Zod, Pino, Helmet                  |
| Database | MongoDB 8 (via Docker)                                               |
| Shared   | `@byke-os/shared`: types and Zod schemas used by both app and API    |
| Tooling  | npm workspaces, ESLint, Prettier, Husky + lint-staged, Vitest, CI    |

## Project structure

```
byke_os/
├── apps/
│   ├── mobile/                 # Expo app → iOS, Android and Web
│   │   └── src/
│   │       ├── app/            # Screens/routes only (Expo Router), kept thin
│   │       ├── features/       # One folder per feature, mirroring api/src/modules
│   │       │   ├── health/     #   api/ + hooks/ + index.ts (public entry)
│   │       │   └── users/      #   api/ + hooks/ (+ components/ when needed)
│   │       ├── components/     # Shared, feature-agnostic UI
│   │       ├── hooks/          # Shared hooks (theme, colour scheme)
│   │       ├── lib/            # Core infrastructure (api-client)
│   │       ├── config/         # Runtime config (API URL)
│   │       └── constants/      # Theme, colours, spacing
│   └── api/                    # Express REST API
│       ├── src/
│       │   ├── config/         # Env validation, logger
│       │   ├── db/             # MongoDB connection
│       │   ├── middlewares/    # Validation, error handling
│       │   ├── modules/        # Feature modules (routes → controller → service → model)
│       │   │   ├── health/
│       │   │   └── users/
│       │   ├── utils/
│       │   ├── app.ts          # Express app factory (no listen, so it's testable)
│       │   ├── routes.ts       # Mounts all modules under /api/v1
│       │   └── server.ts       # Entry point: DB connect, listen, graceful shutdown
│       ├── tests/
│       └── Dockerfile
├── packages/
│   └── shared/                 # Types + validation shared across apps
├── docker-compose.yml          # MongoDB (+ optional containerised API)
└── .github/workflows/ci.yml    # Lint, typecheck, build, test on every push/PR
```

## Prerequisites

- Node.js **22+** (see `.nvmrc`)
- Docker Desktop (for MongoDB), or a local MongoDB / MongoDB Atlas URI
- Phone with **Expo Go**, or an Android emulator / iOS simulator (optional; web works without them)

## Getting started

```bash
npm install                         # installs all workspaces + builds @byke-os/shared
npm run db:up                       # starts MongoDB in Docker on 127.0.0.1:27017
npm run db:migrate                  # creates indexes + the 5 system roles
npm run db:seed                     # creates the first Super Admin (SEED_ADMIN_* in apps/api/.env)
npm run dev                         # runs API (port 4000) and Expo dev server together
```

Then in the Expo terminal press **`w`** for web, **`a`** for Android, or scan the QR code with Expo Go. Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `apps/api/.env`.

> **Expo Go vs development build:** the app uses `expo-secure-store` for the refresh token, which Expo Go includes. If you add a library with custom native code later, switch to a development build (`npx expo run:android`).

Env files are created from the examples; edit as needed:

- `apps/api/.env` ← `apps/api/.env.example`
- `apps/mobile/.env` ← `apps/mobile/.env.example`. On a **physical phone**, set `EXPO_PUBLIC_API_URL` to your PC's LAN IP (e.g. `http://192.168.1.10:4000/api/v1`).

## Scripts (run from the repo root)

| Command                                    | What it does                          |
| ------------------------------------------ | ------------------------------------- |
| `npm run dev`                              | API + app together                    |
| `npm run dev:api` / `npm run dev:app`      | Run one side only                     |
| `npm run web` / `android` / `ios`          | Open the app on a specific platform   |
| `npm run lint` / `typecheck` / `test`      | Quality checks (same as CI)           |
| `npm run format`                           | Prettier on the whole repo            |
| `npm run build`                            | Build shared + API for production     |
| `npm run db:up` / `db:down`                | Start / stop MongoDB                  |
| `npm run db:migrate` / `db:migrate:status` | Apply / list database migrations      |
| `npm run db:seed`                          | Create the first Super Admin          |
| `docker compose --profile full up`         | Run MongoDB **and** the API in Docker |

## API

Base URL: `http://localhost:4000/api/v1`. Every response uses one envelope:

```jsonc
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "...", "details": { ... } } }
```

| Method | Path         | Description               |
| ------ | ------------ | ------------------------- |
| GET    | `/health`    | Liveness + DB status      |
| GET    | `/users`     | List (`?page=1&limit=20`) |
| POST   | `/users`     | Create (validated by Zod) |
| GET    | `/users/:id` | Get one                   |
| PATCH  | `/users/:id` | Update                    |
| DELETE | `/users/:id` | Delete                    |

### Adding a new feature module

1. Add its Zod schema + types in `packages/shared/src/schemas/` and export them from `index.ts`.
2. Create `apps/api/src/modules/<feature>/` with `*.model.ts`, `*.service.ts`, `*.controller.ts`, `*.routes.ts`.
3. Mount the router in `apps/api/src/routes.ts`.
4. Add `apps/mobile/src/features/<feature>/` with `api/`, `hooks/`, `components/` and an `index.ts` that exports its public pieces.

## Conventions

- **Branches:** `feature/…`, `fix/…`, `chore/…` → PR into `main`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:` …).
- **Pre-commit:** Husky runs Prettier on staged files automatically.
- **Mobile packages:** add with `npx expo install <pkg>` (inside `apps/mobile`) so versions match the Expo SDK.
- **Secrets:** never commit `.env`; only `.env.example`. `EXPO_PUBLIC_*` values ship inside the app bundle, so never put secrets in them.
