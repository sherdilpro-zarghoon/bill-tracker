const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Confirms a bill belongs to a consumer owned by the requesting user.
// Every route below must use this before touching a bill by id.
function assertOwnsBill(userId, billId) {
  return db
    .prepare(
      `SELECT b.id FROM bills b
       JOIN consumers c ON c.id = b.consumer_id
       WHERE b.id = ? AND c.user_id = ?`
    )
    .get(billId, userId);
}

async function billsRoutes(fastify) {
  fastify.get('/api/bills', { preHandler: requireAuth }, async (request) => {
    return db
      .prepare(
        `SELECT b.*, c.nickname, p.name AS provider_name
         FROM bills b
         JOIN consumers c ON c.id = b.consumer_id
         JOIN providers p ON p.id = c.provider_id
         WHERE c.user_id = ?
         ORDER BY b.due_date DESC`
      )
      .all(request.user.id);
  });

  fastify.post('/api/bills/:id/pay', { preHandler: requireAuth }, async (request, reply) => {
    const billId = Number(request.params.id);
    if (!assertOwnsBill(request.user.id, billId)) {
      return reply.code(404).send({ error: 'Bill not found' });
    }

    const { amount_paid, paid_on } = request.body || {};
    if (!amount_paid || !paid_on) {
      return reply.code(400).send({ error: 'amount_paid and paid_on are required' });
    }

    db.prepare('INSERT INTO payments (bill_id, amount_paid, paid_on) VALUES (?, ?, ?)').run(
      billId,
      amount_paid,
      paid_on
    );
    db.prepare("UPDATE bills SET status = 'paid' WHERE id = ?").run(billId);

    return { ok: true };
  });

  fastify.get('/api/dashboard/summary', { preHandler: requireAuth }, async (request) => {
    const userId = request.user.id;

    const consumers = db
      .prepare(
        `SELECT c.id, c.nickname, p.name AS provider,
                (SELECT amount FROM bills WHERE consumer_id = c.id ORDER BY fetched_at DESC LIMIT 1) AS amount,
                (SELECT due_date FROM bills WHERE consumer_id = c.id ORDER BY fetched_at DESC LIMIT 1) AS due_date,
                (SELECT status FROM bills WHERE consumer_id = c.id ORDER BY fetched_at DESC LIMIT 1) AS status
         FROM consumers c
         WHERE c.user_id = ?`
      )
      .all(userId);

    const totalDue = db
      .prepare(
        `SELECT COALESCE(SUM(b.amount), 0) AS total
         FROM bills b
         JOIN consumers c ON c.id = b.consumer_id
         WHERE c.user_id = ? AND b.status = 'unpaid'`
      )
      .get(userId).total;

    const monthlyPaid = db
      .prepare(
        `SELECT strftime('%Y-%m', pay.paid_on) AS month, SUM(pay.amount_paid) AS total
         FROM payments pay
         JOIN bills b ON b.id = pay.bill_id
         JOIN consumers c ON c.id = b.consumer_id
         WHERE c.user_id = ?
         GROUP BY month
         ORDER BY month DESC
         LIMIT 12`
      )
      .all(userId);

    return { consumers, total_due: totalDue, monthly_paid: monthlyPaid };
  });
}

module.exports = billsRoutes;
