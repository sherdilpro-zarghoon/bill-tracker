const cheerio = require('cheerio');
const db = require('../config/db');
require('dotenv').config();

const DELAY_MS = Number(process.env.SCRAPE_DELAY_MS || 1500);
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Fetches and parses one consumer's bill using its provider's selector_config.
// Config-driven on purpose: adding a provider should not require new code.
async function scrapeOneConsumer(consumerId) {
  const consumer = db
    .prepare(
      `SELECT c.id, c.consumer_id, p.base_url, p.selector_config
       FROM consumers c
       JOIN providers p ON p.id = c.provider_id
       WHERE c.id = ?`
    )
    .get(consumerId);

  if (!consumer) throw new Error(`Consumer ${consumerId} not found`);

  const url = consumer.base_url.replace('{consumer_id}', encodeURIComponent(consumer.consumer_id));

  let html;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    insertBill(consumer.id, { status: 'fetch_failed' });
    throw err;
  }

  if (!consumer.selector_config) {
    // Provider added by a user but not yet configured with selectors —
    // store the fact that we tried, flag for manual review (see docs/FLOWS.md Flow 5).
    insertBill(consumer.id, { status: 'needs_review' });
    return;
  }

  const selectors = JSON.parse(consumer.selector_config);
  const $ = cheerio.load(html);

  const amountText = $(selectors.amount).first().text().trim();
  const dueDateText = $(selectors.due_date).first().text().trim();
  const issueDateText = selectors.issue_date ? $(selectors.issue_date).first().text().trim() : null;

  insertBill(consumer.id, {
    amount: parseAmount(amountText),
    due_date: dueDateText || null,
    issue_date: issueDateText,
    status: 'unpaid',
  });
}

function parseAmount(text) {
  const cleaned = text.replace(/[^0-9.]/g, '');
  return cleaned ? Number(cleaned) : null;
}

function insertBill(consumerId, { amount = null, due_date = null, issue_date = null, status }) {
  db.prepare(
    `INSERT INTO bills (consumer_id, amount, due_date, issue_date, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(consumerId, amount, due_date, issue_date, status);
}

// Runs across every tracked consumer, sequentially, with a delay between
// each request — keeps memory flat and is polite to provider servers.
async function scrapeAll() {
  const consumers = db.prepare('SELECT id FROM consumers').all();
  console.log(`Starting scrape run for ${consumers.length} consumer(s)`);

  for (const { id } of consumers) {
    try {
      await scrapeOneConsumer(id);
      console.log(`  consumer ${id}: ok`);
    } catch (err) {
      console.error(`  consumer ${id}: failed — ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log('Scrape run complete');
}

// Allow `npm run scrape` to run this directly, and let routes import scrapeOneConsumer
if (require.main === module) {
  scrapeAll().then(() => process.exit(0));
}

module.exports = { scrapeOneConsumer, scrapeAll };
