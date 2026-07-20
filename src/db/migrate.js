const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

console.log('Migration complete: all tables ensured.');
