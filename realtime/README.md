# Clan Fitness realtime server

The WebSocket "something changed" signal server the app uses for live updates, presence and
typing. See the top of `server.mjs` for how it works.

Deployed on Railway (project `clan-fitness-realtime`, service `realtime`), connected to this repo:
every merge to `main` that touches `realtime/` redeploys it automatically — no manual `railway up`.
Service settings (set in Railway, not in this repo):

- **Root directory:** `/realtime`; **watch paths:** `/realtime/**`, so app-only changes don't redeploy it
- **Region:** Singapore (`asia-southeast1-eqsg3a`), the closest to users in India
- **Health check:** `GET /health` must respond before a new deploy replaces the old one
- **Restart policy:** on failure, up to 10 retries

Needs one variable, `REALTIME_SECRET`, matching the app's. Every 5 minutes it logs a `stats`
line (sockets, users, rooms, publishes) to Railway's logs.

Run locally: `REALTIME_SECRET=dev npm start`, and set `NEXT_PUBLIC_REALTIME_URL=http://localhost:8080`
plus the same `REALTIME_SECRET` in the app's `.env.local`.
