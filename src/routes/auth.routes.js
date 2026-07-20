const bcrypt = require('bcrypt');
const db = require('../config/db');
const { signToken } = require('../utils/jwt');

async function authRoutes(fastify) {
  fastify.post('/api/auth/register', async (request, reply) => {
    const { name, email, password } = request.body || {};
    if (!name || !email || !password) {
      return reply.code(400).send({ error: 'name, email and password are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return reply.code(409).send({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, password_hash);

    const token = signToken({ sub: result.lastInsertRowid, email });
    return reply.code(201).send({ token, user: { id: result.lastInsertRowid, name, email } });
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = signToken({ sub: user.id, email: user.email });
    return { token, user: { id: user.id, name: user.name, email: user.email } };
  });
}

module.exports = authRoutes;
