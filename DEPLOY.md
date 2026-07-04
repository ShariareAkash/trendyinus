# Deploying TrendyinUS

The app auto-detects its environment:
- **Vercel:** data → Vercel KV, uploads → Vercel Blob, auth → JWT (all serverless-safe).
- **Local / Node host (Render, Railway…):** data → `db.json`, uploads → `/uploads`.

Repo: **https://github.com/ShariareAkash/trendyinus**

---

## A) Vercel (recommended — free, always-on, live scores work)

### 1. Import the project
1. Go to https://vercel.com → **Add New… → Project** → import **ShariareAkash/trendyinus**.
2. Framework preset: **Other**. Leave build & output settings default. Click **Deploy** (first deploy will run, storage is added next).

### 2. Add free storage (this is what makes the CMS persist)
In the project → **Storage** tab:
- **Create → KV** (Upstash Redis). Connect it to the project. This injects `KV_REST_API_URL` + `KV_REST_API_TOKEN`.
- **Create → Blob**. Connect it. This injects `BLOB_READ_WRITE_TOKEN`.

### 3. Environment variables
Project → **Settings → Environment Variables** → add:
| Name | Value |
|------|-------|
| `ADMIN_USERNAME` | `ShariareAkash` |
| `ADMIN_PASSWORD` | `Puppu@1125084` *(used once to seed the admin, then stored hashed)* |
| `SESSION_SECRET` | any long random string (e.g. run `openssl rand -hex 32`) |

### 4. Redeploy
Deployments → **⋯ → Redeploy** so it picks up the storage + env vars. Open the `…vercel.app` URL, then `…/admin.html` and log in.

### 5. Custom domain
Project → **Settings → Domains** → add **trendyinus.com** and **www.trendyinus.com**. Vercel shows the exact DNS records — add them at your registrar (or InfinityFree's DNS panel if the domain is parked there). HTTPS is automatic.

**Vercel notes**
- Function request bodies are capped at ~4.5 MB on Hobby, so keep uploaded images under ~4 MB (logos/avatars are fine). Article images that are external URLs are unaffected.
- Live scores work (Vercel allows outbound requests).

---

## B) Render (alternative — zero config, but sleeps on free tier)
1. render.com → **New → Web Service** → pick the repo → Start command `node server.js`.
2. Env vars: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
3. Free tier uses the local `db.json` (ephemeral — resets on restart) unless you add a paid disk (`render.yaml` has the block ready).

---

## Why not InfinityFree?
PHP/MySQL only — no Node.js, and it blocks outbound requests (live scores would fail). Would require a full PHP rewrite.
