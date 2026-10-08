# 75 Hard

A 75 Hard challenge tracker you can install on your phone's Home Screen. Each person signs in and sees only their own challenges.

- **Home:** your current challenge (only one can be active at a time) and past ones.
- **Create:** starts with the standard 75 Hard tasks. You can edit, add or remove tasks, then pick a start date. Challenges are locked once created.
- **Dashboard / Tasks / Calendar:** progress, today's checklist (each day stays open until 4 AM the next morning, in the challenge's timezone) and a calendar of completed days.
- **Rules:** if a day isn't fully checked off, the challenge fails automatically. You can also fail it yourself at any time.
- **Reminders:** optional morning and evening push notifications.

## Stack

- Preact + Vite + TypeScript, hosted on Vercel (`vercel.json` sets the security headers). Pushes to `main` deploy automatically.
- Supabase Auth and Postgres (`supabase/migrations`). Every table uses row level security and is read-only to clients. All writes go through database functions that check the signed-in user and the challenge rules.
- Supabase Edge Functions (`supabase/functions`) send Web Push reminders. `pg_cron` calls them every 5 minutes. The VAPID private key and the cron secret are stored in Supabase Vault and never in this repo.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/
npm test
npm run build
```
