# Bill Tracker — Application Flows

This document describes how data moves through the system: from a user
registering, to a bill being scraped, to it showing up on the dashboard.

---

## 1. High-level architecture

```
                    ┌─────────────────────────────┐
                    │        Oracle Cloud VM       │
                    │                               │
  Angular/Svelte    │   ┌────────┐    ┌──────────┐  │
  web dashboard ───▶│   │ Nginx  │───▶│ Node API │  │
                    │   └────────┘    │ (Fastify)│  │
  Flutter mobile ───▶│                └────┬─────┘  │
  app                │                     │        │
                    │              ┌──────▼──────┐ │
                    │              │  SQLite /   │ │
                    │              │  Postgres   │ │
                    │              └──────▲──────┘ │
                    │                     │        │
                    │              ┌──────┴──────┐ │
                    │              │  Scraper     │ │
                    │              │  worker      │ │
                    │              │ (PM2 timer)  │ │
                    │              └──────┬──────┘ │
                    └─────────────────────┼────────┘
                                          │
                              ┌───────────▼───────────┐
                              │  Utility provider      │
                              │  websites (FESCO,      │
                              │  LESCO, SNGPL, ...)    │
                              └────────────────────────┘
```

The API and scraper are the same Node codebase, run as two PM2 processes so
a slow scrape never blocks a user's API request.

---

## 2. Core entities

| Entity      | Purpose                                                             |
|-------------|----------------------------------------------------------------------|
| `users`     | One row per person (you, family members). Owns login credentials.   |
| `providers` | Global, shared list of utility companies (FESCO, LESCO, SNGPL, ...).|
| `consumers` | A user's specific account with a provider (their consumer ID).      |
| `bills`     | A scraped bill snapshot for a consumer, for one billing cycle.      |
| `payments`  | A record that a bill (or part of it) was paid, entered by the user. |

`providers` is the only table that isn't scoped to a user — it's shared
reference data, seeded once and extendable by any user through "add a new
provider" (see Flow 5).

---

## 3. Flow: user registration & login

1. User opens the app (web or mobile) → **Register** screen.
2. Client `POST /api/auth/register` with `{ name, email, password }`.
3. Server hashes password with bcrypt, inserts into `users`, returns a JWT.
4. Client stores the JWT (secure storage on mobile, memory/cookie on web).
5. Every subsequent request sends `Authorization: Bearer <token>`.
6. Server middleware (`middleware/auth.js`) verifies the token on every
   protected route and attaches `req.user`.

Login (`POST /api/auth/login`) is the same, minus the insert — it compares
the submitted password against the stored bcrypt hash.

---

## 4. Flow: adding a consumer (a bill to track)

1. User taps **Add bill** → picks a category (electricity / gas / water).
2. App calls `GET /api/providers?category=electricity` → server returns the
   list of providers in that category (from the seeded `providers` table),
   filtered to the user's region if they've set one (optional convenience).
3. User picks a provider (e.g. "FESCO"), enters their consumer/reference
   number, and an optional nickname ("Home meter").
4. Client `POST /api/consumers` with `{ provider_id, consumer_id, nickname }`.
5. Server inserts a row into `consumers` scoped to `req.user.id`.
6. Server immediately triggers one scrape for this new consumer (so the
   user sees a result right away instead of waiting for the next scheduled
   run) — see Flow 6.

---

## 5. Flow: adding a new provider (extending the defaults)

Only needed when a provider isn't already in the seeded list.

1. User picks **"My provider isn't listed"**.
2. Form asks for: name, category, the URL pattern for checking a bill, and
   the consumer ID label shown on their physical bill.
3. Client `POST /api/providers` with this data. The row is created with
   `is_default = false` and `selector_config = null`.
4. Because the scraper doesn't yet know how to parse this provider's HTML,
   the new consumer's first "scrape" just stores the fetched page as
   `status = "needs_review"` instead of parsed bill data.
5. **You** (the admin) inspect the page structure once and fill in
   `selector_config` for that provider — after that, it scrapes like any
   default provider. This is a manual step by design: auto-detecting bill
   fields from arbitrary HTML reliably isn't realistic, but it only has to
   happen once per new provider, not once per user.

---

## 6. Flow: scheduled scraping

1. PM2 (or a systemd timer) runs `scraper.service.js` once or twice daily.
2. The worker loads all `consumers` rows joined with their `providers`
   config.
3. For each consumer, **sequentially** (small delay between each, to be
   polite to provider servers and keep memory flat):
   a. Build the request URL from `provider.base_url` + `consumer.consumer_id`.
   b. Fetch the HTML with a plain HTTP GET (Cheerio-based — no headless
      browser).
   c. Parse fields using `provider.selector_config`.
   d. If a bill for this billing cycle already exists, update it; otherwise
      insert a new row into `bills`.
   e. On failure (site down, selectors no longer match), log the error and
      mark that consumer's last fetch as `status = "fetch_failed"` — the
      app shows this so the user knows to check manually, rather than
      silently showing stale data as if it were current.
4. Worker exits. PM2 cron restarts it at the next scheduled time.

---

## 7. Flow: dashboard view

1. Client `GET /api/dashboard/summary` (authenticated).
2. Server queries, scoped to `req.user.id`:
   - All consumers with their latest bill (amount, due date, status).
   - Total amount currently due across all bills.
   - Monthly paid totals for the last 12 months (for the chart).
3. Response shape:
   ```json
   {
     "consumers": [
       { "nickname": "Home meter", "provider": "FESCO", "amount": 4200,
         "due_date": "2026-07-28", "status": "unpaid" }
     ],
     "total_due": 4200,
     "monthly_paid": [{ "month": "2026-06", "total": 11500 }, ...]
   }
   ```
4. Client renders the table + chart from this single response.

---

## 8. Flow: marking a bill as paid

1. User taps **Mark as paid** on a bill.
2. Client `POST /api/bills/:id/pay` with `{ amount_paid, paid_on }`.
3. Server verifies the bill belongs to a consumer owned by `req.user.id`
   (authorization check — never trust the bill ID alone).
4. Inserts a `payments` row, updates `bills.status` to `"paid"`.

---

## 9. Authorization rule (applies to every route above)

Every query that touches `consumers`, `bills`, or `payments` must filter by
ownership through `req.user.id` — e.g.
`WHERE consumers.user_id = ?` or a join back to it. `providers` is the only
table readable by any authenticated user regardless of who created it.
