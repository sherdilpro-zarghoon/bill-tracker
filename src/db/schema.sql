-- Users
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Providers: shared reference data (FESCO, LESCO, SNGPL, WASA, ...)
CREATE TABLE IF NOT EXISTS providers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('electricity','gas','water')),
  region           TEXT,                 -- e.g. "Faisalabad, Jhang, Sargodha"
  id_label         TEXT NOT NULL,        -- e.g. "14-digit Reference Number"
  base_url         TEXT NOT NULL,        -- e.g. "https://.../bill?ref={consumer_id}"
  selector_config  TEXT,                 -- JSON string, null until configured
  is_default       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Consumers: a user's specific account with a provider
CREATE TABLE IF NOT EXISTS consumers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id  INTEGER NOT NULL REFERENCES providers(id),
  consumer_id  TEXT NOT NULL,   -- the reference/consumer number on their bill
  nickname     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bills: one row per billing cycle per consumer
CREATE TABLE IF NOT EXISTS bills (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  consumer_id  INTEGER NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  amount       REAL,
  due_date     TEXT,
  issue_date   TEXT,
  status       TEXT NOT NULL DEFAULT 'unpaid'
               CHECK (status IN ('unpaid','paid','fetch_failed','needs_review')),
  fetched_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payments: user-entered confirmation that a bill was paid
CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id      INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount_paid  REAL NOT NULL,
  paid_on      TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_consumers_user ON consumers(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_consumer ON bills(consumer_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
