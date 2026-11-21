# Deploying Byke OS

| Part     | Where           | Config                                    |
| -------- | --------------- | ----------------------------------------- |
| Database | MongoDB Atlas   | connection string in Render's environment |
| API      | Render (Docker) | `render.yaml`, `apps/api/Dockerfile`      |
| Web app  | Vercel (static) | `apps/mobile/vercel.json`                 |

Both Render and Vercel deploy from a GitHub repository, so push the repo first (never commit `.env` files).

## 1. MongoDB Atlas

1. **Network Access** → Add IP address → `0.0.0.0/0` (Render has no fixed IPs).
2. **Database Access** → a user with read/write. Note its password.
3. Connection string, with the database name `byke_os` added before `?`:
   `mongodb+srv://<user>:<password>@cluster0.par0z7y.mongodb.net/byke_os?retryWrites=true&w=majority&appName=Cluster0`

## 2. API on Render

1. Render → **New → Blueprint** → pick the GitHub repo. It reads `render.yaml`.
2. Fill in the two secret values it asks for:
   - `MONGODB_URI`: the Atlas string from step 1.
   - `CORS_ORIGINS`: the web app's URL from step 3 (e.g. `https://byke-os.vercel.app`). Put any value first and update it after step 3.
3. Deploy. The container applies pending migrations, then starts. Check
   `https://<render-service>.onrender.com/api/v1/health` → `"database":"connected"`.

**Photos:** task proof photos are saved on the server's disk. On Render that disk is wiped on every deploy/restart unless the service is on a paid plan with the persistent disk in `render.yaml` enabled. The free plan also sleeps after 15 minutes idle (first request then takes about a minute).

## 3. Web app on Vercel

1. Vercel → **Add New → Project** → the same repo.
2. **Root Directory:** `apps/mobile` (framework: Other; build settings come from `vercel.json`).
3. **Environment variable:** `EXPO_PUBLIC_API_URL` = `https://<render-service>.onrender.com/api/v1`.
   It is baked in at build time: redeploy after changing it.
4. Deploy, then put the Vercel URL into Render's `CORS_ORIGINS` (step 2) and let Render redeploy.

## 4. First admin user

Run once from your computer against Atlas (uses `SEED_ADMIN_*` from `apps/api/.env`; choose a strong password for production):

```powershell
cd apps/api
$env:MONGODB_URI = "<Atlas connection string>"
npm run migrate:up
npm run seed
Remove-Item Env:MONGODB_URI
```

## Phones

The Android / iOS apps need `EXPO_PUBLIC_API_URL` pointing at the Render URL and an EAS build (`npx eas-cli@latest build`); not covered here.
