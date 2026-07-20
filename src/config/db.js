const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.SQLITE_PATH || './data/bills.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // safer + faster for concurrent read/write

module.exports = db;
