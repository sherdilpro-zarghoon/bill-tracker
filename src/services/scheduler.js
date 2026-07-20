const cron = require('node-cron');
const { scrapeAll } = require('./scraper.service');

// Runs every day at 08:00 and 20:00 server time. Adjust as needed.
cron.schedule('0 8,20 * * *', () => {
  console.log(`[${new Date().toISOString()}] Scheduled scrape starting`);
  scrapeAll().catch((err) => console.error('Scheduled scrape failed', err));
});

console.log('Scraper scheduler started (runs at 08:00 and 20:00 daily)');
