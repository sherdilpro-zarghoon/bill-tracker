const { verifyToken } = require('../utils/jwt');

// Fastify preHandler: verifies the bearer token and attaches req.user
async function requireAuth(request, reply) {
  const header = request.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = verifyToken(token);
    request.user = { id: payload.sub, email: payload.email };
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
