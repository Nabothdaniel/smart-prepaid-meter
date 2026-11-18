# Smart Prepaid Meter dashboard

Next.js 15 + SQLite recreation of the Blynk dashboard, with a software meter that replaces the ESP8266.

    npm install
    npm run dev        # http://localhost:3000

- First start seeds `data/meter.db` with 24 h of history, then **records a reading every 5 s** for as long as the server runs.
- `lib/sim.ts` ports the firmware's Algorithms 3-7 (billing, tokens, relay, over/under-voltage, over-current).
- Valid tokens: TOKEN100, 200, 500, 1000, 2000, 5000.
- `npm run reseed` wipes the database; it is re-seeded on next start.
- Export all readings: `/api/export` (CSV).

## Saving and deploying

Everything is saved to `data/meter.db` automatically: a reading every 5 s, credit/energy/relay state on every change, plus recharges and events. The WAL is flushed into the main file every 30 s and on shutdown, so `data/meter.db` is committed to git and a deploy starts with all recorded history. The database is only seeded when it doesn't exist yet.

Deploy to a host that runs a long-lived Node process **and has a persistent disk** (Render, Railway, Fly.io, a VPS). Serverless hosts such as Vercel can't be used: the simulator needs to keep running and the filesystem is read-only/ephemeral.

    npm install && npm run build && npm start
    DATA_DIR=/data npm start        # when the persistent disk is mounted at /data

With a persistent disk, copy `data/meter.db` to it once; after that the host keeps recording. Don't run the local and online copies at the same time, as their databases will diverge.

## Accounts and roles

Sign in at `/login`. Demo accounts (one-click on the login page; set `DEMO_LOGINS=off` to hide them):

| Role | Email | Password |
|---|---|---|
| Customer | user@demo.com | user123 |
| Admin | admin@demo.com | admin123 |

**Customer** (`/`): live usage, history, recharge, switch appliances, own activity log. Recharging and appliance control can each be turned off by the admin.

**Admin** (`/admin`): everything the customer sees, plus disconnect/restore the supply, reset protection trips, change tariff and low-credit alert, add or remove credit, switch customer permissions, send a notice, run fault simulations and speed, export readings CSV, and see the activity log of every user. All admin and customer actions are written to the `audit` table. 24 h of demo log entries are seeded for both roles.

Passwords are stored as scrypt hashes and sessions are random tokens in an httpOnly cookie. **Change the demo passwords before real use.**

## Hosting notes

- **Sessions** are signed cookies (no database lookup), so login works on serverless hosts. Set `SESSION_SECRET` to a long random string in production (a demo default is used if unset).
- **Vercel / serverless:** every function gets its own temporary copy of the database, so admin actions, credit changes and new readings are *not* shared between pages and reset on cold start. Good enough to show the UI only.
- **Fully working (recommended):** deploy to Render using `render.yaml` (free plan, one always-on process, so recording and admin-to-customer control work). Add a persistent disk and `DATA_DIR` to keep data across restarts.
