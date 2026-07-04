# Deploying TrendyinUS to a free Node host + trendyinus.com

**Important:** InfinityFree only runs PHP/MySQL — it **cannot** run this Node.js app.
This guide uses **Render.com** (free Node hosting). Railway/Fly.io/Cyclic work the same way.
You point **trendyinus.com** at Render with a couple of DNS records.

The app is a zero-dependency Node server, so there's nothing to build — just run `node server.js`.

---

## 1. Put the code on GitHub (once)

1. Create a free account at https://github.com and click **New repository** → name it `trendyinus` → **Create**.
2. Upload this whole `trendyinus_new` folder:
   - Easiest: on the new repo page click **"uploading an existing file"**, then drag in every file/folder
     (`server.js`, `package.json`, `render.yaml`, `assets/`, all the `.html` files, etc.).
   - Do **not** upload `node_modules`, `db.json`, or `uploads/` (there are none needed; `.gitignore` skips them).
3. Commit.

## 2. Deploy on Render (free)

1. Sign up at https://render.com with your GitHub account.
2. Click **New +** → **Web Service** → pick your `trendyinus` repo.
3. Settings:
   - **Runtime:** Node
   - **Build Command:** *(leave empty)*
   - **Start Command:** `node server.js`
   - **Instance type:** Free
4. Under **Environment**, add two variables (this is how your admin login is set — no password lives in the code):
   - `ADMIN_USERNAME` = `ShariareAkash`
   - `ADMIN_PASSWORD` = `Puppu@1125084`  *(change it to whatever you like)*
5. Click **Create Web Service**. In ~1 minute you'll get a live URL like
   `https://trendyinus.onrender.com` — open it to confirm it works, and `…/admin.html` to log in.

*(Or: New + → Blueprint → pick the repo; `render.yaml` auto-fills everything — you just enter the two env vars.)*

## 3. Connect your domain trendyinus.com

1. In Render, open the service → **Settings** → **Custom Domains** → **Add** `trendyinus.com`, then add `www.trendyinus.com`.
2. Render shows you the exact DNS records to create. Typically:
   - `www` → **CNAME** → `trendyinus.onrender.com`
   - root `@` (`trendyinus.com`) → **A record** → the IP Render gives you (or an ALIAS/ANAME to the onrender host).
3. Add those records wherever **trendyinus.com's DNS** is managed — at your **domain registrar** (where you bought the domain), or in the **InfinityFree control panel → DNS/CNAME Records** if the domain is parked there.
4. Wait for DNS to propagate (minutes to a few hours). Render auto-issues a free HTTPS certificate.

Done — `https://trendyinus.com` now serves the site, admin at `https://trendyinus.com/admin.html`.

---

## Things to know

- **Free tier sleeps.** Render free services spin down after ~15 min idle and cold-start on the next visit
  (a few seconds). Also, the **free disk is temporary** — any posts/settings/uploads you add through the
  admin are **reset when the service restarts or redeploys**.
- **To make content permanent:** upgrade the Render instance and add a **Disk** (uncomment the `disk:` block
  and the `DATA_DIR` env var in `render.yaml`, mount at `/var/data`). Then db.json + uploads persist forever.
  Alternatively keep free and just re-add content after a restart.
- **Admin password** is only ever read from `ADMIN_PASSWORD` on a fresh database, then stored **hashed**
  (scrypt) — never in plaintext.
- **Live scores** work on Render (it allows outbound requests). They would NOT have worked on InfinityFree.
- `robots.txt` and `sitemap.xml` are generated automatically and will show your real `https://trendyinus.com`
  URLs once the domain is live.

## Why not InfinityFree?
InfinityFree = PHP + MySQL only, no Node.js, no long-running processes, and it blocks most outbound requests
(so live scores would fail). Running this app there would require rewriting the entire backend in PHP.
