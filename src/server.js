require('dotenv').config();
const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/cors'), { origin: true });

fastify.register(require('./routes/auth.routes'));
fastify.register(require('./routes/consumers.routes'));
fastify.register(require('./routes/bills.routes'));

fastify.get('/health', async () => ({ status: 'ok' }));

const port = Number(process.env.PORT || 3000);
fastify
  .listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`API listening on port ${port}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
