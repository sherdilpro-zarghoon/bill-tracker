const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { scrapeOneConsumer } = require('../services/scraper.service');

async function consumersRoutes(fastify) {
  // List providers, optionally filtered by category (electricity/gas/water)
  fastify.get('/api/providers', async (request) => {
    const { category } = request.query || {};
    if (category) {
      return db.prepare('SELECT * FROM providers WHERE category = ? ORDER BY name').all(category);
    }
    return db.prepare('SELECT * FROM providers ORDER BY category, name').all();
  });

  // Add a provider not already in the default list
  fastify.post('/api/providers', { preHandler: requireAuth }, async (request, reply) => {
    const { name, category, region, id_label, base_url } = request.body || {};
    if (!name || !category || !id_label || !base_url) {
      return reply.code(400).send({ error: 'name, category, id_label and base_url are required' });
    }
    const result = db
      .prepare(`INSERT INTO providers (name, category, region, id_label, base_url, is_default)
                VALUES (?, ?, ?, ?, ?, 0)`)
      .run(name, category, region || null, id_label, base_url);
    return reply.code(201).send({ id: result.lastInsertRowid });
  });

  // List the current user's tracked consumers/bills
  fastify.get('/api/consumers', { preHandler: requireAuth }, async (request) => {
    return db
      .prepare(
        `SELECT c.id, c.nickname, c.consumer_id, p.name AS provider_name, p.category
         FROM consumers c
         JOIN providers p ON p.id = c.provider_id
         WHERE c.user_id = ?`
      )
      .all(request.user.id);
  });

  // Add a new consumer (a bill to track) for the current user
  fastify.post('/api/consumers', { preHandler: requireAuth }, async (request, reply) => {
    const { provider_id, consumer_id, nickname } = request.body || {};
    if (!provider_id || !consumer_id) {
      return reply.code(400).send({ error: 'provider_id and consumer_id are required' });
    }

    const result = db
      .prepare('INSERT INTO consumers (user_id, provider_id, consumer_id, nickname) VALUES (?, ?, ?, ?)')
      .run(request.user.id, provider_id, consumer_id, nickname || null);

    // Fire an immediate scrape so the user doesn't wait for the next scheduled run.
    // Errors here are logged, not thrown — adding the consumer should still succeed.
    scrapeOneConsumer(result.lastInsertRowid).catch((err) =>
      fastify.log.error(err, 'Initial scrape failed for new consumer')
    );

    return reply.code(201).send({ id: result.lastInsertRowid });
  });
}

module.exports = consumersRoutes;
