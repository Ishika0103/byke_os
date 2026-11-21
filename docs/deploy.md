# Deploying Byke OS (all on Render)

| Part     | Where                            | Config                               |
| -------- | -------------------------------- | ------------------------------------ |
| Database | MongoDB Atlas                    | `MONGODB_URI` on the API service     |
| API      | Render web service `byke-os-api` | `render.yaml`, `apps/api/Dockerfile` |
| Web app  | Render static site `byke-os-web` | `render.yaml`                        |

Render deploys from the GitHub repo (`main`); every push redeploys both services.

## 1. MongoDB Atlas

1. **Network Access** → Add IP address → `0.0.0.0/0` (Render has no fixed IPs).
2. **Database Access** → a user with read/write. Note its password.
3. Connection string, with the database name `byke_os` added before `?`:
   `mongodb+srv://<user>:<password>@cluster0.par0z7y.mongodb.net/byke_os?retryWrites=true&w=majority&appName=Cluster0`

## 2. Render Blueprint

1. Render → **New → Blueprint** → connect GitHub → pick the repo. It reads `render.yaml` and shows two services.
2. Fill in the values it asks for. The URLs are `https://<service name>.onrender.com`; if Render shows different ones after creating the services, update these values to match:
   - `byke-os-api` → `MONGODB_URI`: the Atlas string from step 1.
   - `byke-os-api` → `CORS_ORIGINS`: `https://byke-os-web.onrender.com`
   - `byke-os-web` → `EXPO_PUBLIC_API_URL`: `https://byke-os-api.onrender.com/api/v1`
3. **Apply.** Then check `https://byke-os-api.onrender.com/api/v1/health` → `"database":"connected"`, and open `https://byke-os-web.onrender.com`.

`EXPO_PUBLIC_API_URL` is baked into the web app when it's built: after changing it, redeploy `byke-os-web` (Manual Deploy → Clear build cache & deploy).

**Photos:** task proof photos are saved on the API server's disk. On Render that disk is wiped on every deploy/restart unless the API is on a paid plan with the persistent disk in `render.yaml` enabled. The free plan also sleeps after 15 minutes idle (the first request then takes about a minute).

## 3. First admin user

Run once from your computer against Atlas (uses `SEED_ADMIN_*` from `apps/api/.env`; choose a strong password for production):

```powershell
cd apps/api
$env:MONGODB_URI = "<Atlas connection string>"
npm run migrate:up
npm run seed
Remove-Item Env:MONGODB_URI
```

## Phones

The Android / iOS apps need `EXPO_PUBLIC_API_URL` pointing at the Render API URL and an EAS build (`npx eas-cli@latest build`); not covered here.
