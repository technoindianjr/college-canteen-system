# Campus Canteen – Staff & Admin Console

React + Vite + TypeScript web app for the canteen counter and the admin. Students use the Flutter app.

| Who | Pages |
| --- | --- |
| Staff and admin | Order board (live, with new-order chime), Pickup by 4-digit code, Availability + Pause ordering, Today |
| Admin only | Menu (items, combos, categories, specials), Users, Reports, All orders, Settings |

Staff sign in with **email + password** (`POST /auth/password-login`). The API re-checks the role on every request, so hiding a link is never the only protection.

## Run it locally

```bash
# 1. API (see ../../server/README.md for MySQL setup)
cd server && npm run dev                # http://127.0.0.1:3000

# 2. Console
cd apps/web && npm install && npm run dev   # http://localhost:5173
```

The dev server proxies `/api`, `/uploads` and `/socket.io` to `127.0.0.1:3000` (`vite.config.ts`), so no CORS settings are needed.

Create the first admin: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env`, run `npm run db:seed`, then remove the password from `.env`.
More staff: sign in as admin → Users → **Add staff**.

Sound: browsers block audio until the page is clicked, so press **Enable sound** once after opening the console on the counter tablet.

## Deploy (Mac mini, behind Caddy)

The console is static files. `deploy/Caddyfile` serves `apps/web/dist` on its own hostname and proxies `/api`, `/uploads` and `/socket.io` to the API on the same host (same origin).

```bash
cd apps/web
npm ci && npm run build            # writes dist/

# edit deploy/Caddyfile: console.example.com -> your hostname, root path -> .../apps/web/dist,
# and wss://console.example.com in the Content-Security-Policy
caddy validate --config deploy/Caddyfile
mkdir -p /opt/homebrew/var/log/caddy
sudo cp deploy/Caddyfile /opt/homebrew/etc/Caddyfile && brew services restart caddy
```

Updating the console after `git pull`: `cd apps/web && npm ci && npm run build`. Caddy serves the new files immediately (`index.html` is `no-cache`, hashed assets are cached forever), no restart needed.

The API must also be updated and restarted when the server changes (it adds the `users.email` / `password_hash` columns, so run `npm run db:migrate` first):
`cd server && npm ci && npm run build && npm run db:migrate && pm2 restart canteen-api`.

Checklist:
- The Mac user running Caddy must be able to read `apps/web/dist` (home folders are private by default; `chmod o+x` the parent directories or keep the repo somewhere Caddy can read).
- `AUTH_DEV_MODE=false` and `NODE_ENV=production` in `server/.env`; remove `ADMIN_PASSWORD` after the first admin exists.
- Login attempts are rate-limited per IP + email (5 per minute) in memory; they reset when the API restarts.
- Only ports 80/443 should be open to the outside.
