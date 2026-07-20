# Bill Tracker API

Generic, multi-provider utility bill tracker (electricity, gas, water) for
Pakistan. Config-driven scraper — adding a new provider is a database row,
not new code. See `docs/FLOWS.md` for the full flow documentation.

## Stack

Node.js + Fastify + better-sqlite3 + Cheerio + PM2. Chosen to run
comfortably on a memory-constrained VM (~600MB free) — no build step, no
headless browser, no separate database daemon.

## First-time setup (local or VM)

```bash
npm install
cp .env.example .env        # then edit JWT_SECRET at minimum
npm run migrate             # creates tables
npm run seed                # inserts default Pakistani providers
npm start                   # or: pm2 start ecosystem.config.js
```

Health check: `GET http://localhost:3000/health` → `{ "status": "ok" }`

## Project layout

```
src/
  server.js              Fastify app entrypoint (the API)
  config/db.js           SQLite connection
  db/
    schema.sql           Table definitions
    migrate.js           Applies schema.sql
    seed_providers.js    Inserts default DISCOs/gas/water providers
  middleware/auth.js     JWT verification (Fastify preHandler)
  routes/
    auth.routes.js       /api/auth/register, /api/auth/login
    consumers.routes.js  /api/providers, /api/consumers
    bills.routes.js      /api/bills, /api/dashboard/summary
  services/
    scraper.service.js   Config-driven scraper (one consumer or all)
    scheduler.js         node-cron entrypoint, run by PM2 as a second process
  utils/jwt.js           sign/verify helpers
docs/
  FLOWS.md               Full flow documentation
ecosystem.config.js       PM2 config: runs API + scheduler as 2 processes
```

## Configuring a provider's scraper

After seeding, every default provider has `selector_config = NULL` and a
placeholder `base_url`. Before it can scrape:

1. Find the provider's real, official bill-check URL and replace
   `base_url` (keep the `{consumer_id}` placeholder).
2. Open the resulting bill page in a browser, inspect the HTML, and find
   the CSS selectors for the amount, due date, and issue date.
3. Update that row's `selector_config`, e.g.:
   ```sql
   UPDATE providers
   SET base_url = 'https://official-site.gov.pk/bill?ref={consumer_id}',
       selector_config = '{"amount": ".bill-amount", "due_date": ".due-date", "issue_date": ".issue-date"}'
   WHERE name = 'FESCO';
   ```
4. Test with: `node -e "require('./src/services/scraper.service').scrapeOneConsumer(<id>)"`

## Deploying with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to enable on boot
```

This runs two lightweight processes: `bill-api` (the Fastify server) and
`bill-scheduler` (fires the scraper twice daily via cron inside Node —
see `src/services/scheduler.js` to change the schedule).

## Environment variables

See `.env.example`. At minimum, set a real `JWT_SECRET` before deploying —
never use the placeholder value in production.
