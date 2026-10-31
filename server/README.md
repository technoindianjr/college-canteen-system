# Campus Canteen API

Node.js 22 + TypeScript + Fastify + Drizzle ORM + MySQL 8, with Socket.IO for live order status.
Version 1 is **pay at the counter** (cash or the canteen's UPI QR). Razorpay is phase 2.

## Run it locally (Mac)

```bash
brew install node@22 mysql@8.4
brew services start mysql@8.4

# one-time database setup
mysql -uroot -e "CREATE DATABASE canteen; CREATE DATABASE canteen_test;
  CREATE USER 'canteen'@'localhost' IDENTIFIED BY 'choose-a-password';
  GRANT ALL ON canteen.* TO 'canteen'@'localhost';
  GRANT ALL ON canteen_test.* TO 'canteen'@'localhost';"

cd server
cp .env.example .env        # set DATABASE_URL password and JWT_SECRET (openssl rand -hex 32)
npm install
npm run db:migrate          # creates the tables
npm run db:seed             # categories, starter menu, combos, default settings
npm run dev                 # http://127.0.0.1:3000/api/v1/health
```

### Logging in without SMS (development)

With `AUTH_DEV_MODE=true`, send `dev:<phone>` as the ID token:

```bash
curl -s -X POST localhost:3000/api/v1/auth/otp-login \
  -H 'content-type: application/json' -d '{"idToken":"dev:+919999999999"}'
```

Phones listed in `ADMIN_PHONES` become admins. The server **refuses to start** with dev mode on when `NODE_ENV=production`.

### Tests

```bash
npm test        # recreates canteen_test from the migrations, then runs the API tests
npm run typecheck
```

## Real phone OTP (Firebase)

1. Create a Firebase project, enable **Authentication → Phone**, add the Android/iOS apps.
2. Project settings → Service accounts → **Generate new private key**. Save the JSON on the Mac mini outside the repo (e.g. `~/secrets/firebase-canteen.json`).
3. Set `FIREBASE_SERVICE_ACCOUNT_PATH` to that file. The same key sends push notifications (FCM).
4. The Flutter app signs in with `firebase_auth`, gets `user.getIdToken()`, and posts it to `/auth/otp-login`. The API answers with its own JWT (30 days).

## API (prefix `/api/v1`)

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | anyone | Uptime check (also checks MySQL) |
| POST | `/auth/otp-login` | anyone | `{idToken}` → `{token, user}` |
| GET / PATCH | `/me` | logged in | Profile; PATCH `{name, rollNo, fcmToken}` (name required before ordering) |
| GET | `/menu` | anyone | Categories with items, combos, popular ids, today's specials, ordering open/paused |
| POST | `/orders` | student | `{items:[{menuItemId\|comboId, qty, note?}], note?}` → order with pickup code |
| GET | `/orders/mine` | student | Last 50 orders |
| GET | `/orders/:id` | owner, staff | One order |
| POST | `/orders/:id/cancel` | owner | Only while `placed` |
| POST | `/orders/:id/feedback` | owner | `{rating 1-5, comment?}` after pickup |
| GET | `/staff/orders?scope=open\|today` | staff | Order board (oldest first) with customer name/roll no |
| GET | `/staff/lookup?code=1234` | staff | Find an open order by pickup code |
| PATCH | `/staff/orders/:id` | staff | `{action: accept\|ready\|pickup}`; pickup needs `pickupCode` + `paymentMethod: cash\|upi_counter` |
| POST | `/staff/orders/:id/reject` | staff | `{reason}` |
| PATCH | `/staff/items/:id`, `/staff/combos/:id` | staff | `{isAvailable}` sold-out toggle |
| POST | `/staff/pause` | staff | `{paused}` stop/resume app orders |
| * | `/admin/categories`, `/admin/items`, `/admin/combos`, `/admin/specials` | admin | Menu management; `POST /admin/items/:id/image` (multipart `image`, ≤5 MB) |
| GET / POST / PATCH | `/admin/users` | admin | Search, pre-register staff by phone, change role, block/unblock, reset no-shows |
| GET / PUT | `/admin/settings` | admin | Opening hours, limits, no-show rules |
| GET | `/admin/orders?date=YYYY-MM-DD` | admin | All orders for a day |
| GET | `/admin/reports/summary?from=&to=` | admin | Orders, revenue (cash vs UPI), top items, by hour/day, times, ratings |

Errors are `{error: "<code>", message: "<text for the user>"}`. Money is integer **paise**.

### Order rules (v1)

`placed → preparing → ready → picked_up` (staff record cash/UPI at pickup).
Exits: `cancelled` (student, only while placed), `rejected` (staff, with reason), `no_show` (ready and not collected in `no_show_minutes`).
Limits from settings: max open orders per student (2), orders per 10 minutes (40), block after 3 no-shows, opening hours (08:00–18:00 IST; same open and close time = all day).

### Real-time (Socket.IO)

Connect to the server root with `io(url, { auth: { token } })`.
Events: `order:new` (staff), `order:updated` (owner + staff), `menu:changed` (everyone → refetch `/menu`), `settings:changed`.

## Deploy on the Mac mini

```bash
brew install node@22 mysql@8.4 caddy
npm i -g pm2
brew services start mysql@8.4          # bind-address = 127.0.0.1 (default)

cd college-canteen-system/server
cp .env.example .env                    # NODE_ENV=production, AUTH_DEV_MODE=false, real secrets, HOST=127.0.0.1
npm ci && npm run build && npm run db:migrate && npm run db:seed

cd .. && mkdir -p logs
pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup   # follow the printed command

# HTTPS: edit deploy/Caddyfile (your domain), then
sudo cp deploy/Caddyfile /opt/homebrew/etc/Caddyfile && brew services start caddy
```

Also: System Settings → Energy → prevent sleep + "Start up automatically after a power failure"; macOS firewall on with only 80/443 open to the outside;
nightly `deploy/backup.sh` via crontab; an uptime monitor on `https://<your-domain>/api/v1/health`.

Updating: `git pull && cd server && npm ci && npm run build && npm run db:migrate && pm2 restart canteen-api`.

## Changing the database

Edit `src/db/schema.ts`, then `npm run db:generate -- --name <what-changed>` to write a new SQL file in `drizzle/`, review it, commit it, and run `npm run db:migrate`.
