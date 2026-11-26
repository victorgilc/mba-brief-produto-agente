import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify, { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { config } from './config.js';
import { makeAuthHelpers } from './middleware/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerEventRoutes } from './routes/events.js';
import { registerPartnerRoutes } from './routes/partner.js';
import { registerPurchaseRoutes } from './routes/purchases.js';
import { GatewayDelayMode, SimulatedGateway } from './services/gateway.js';

export interface AppOptions {
  pool: Pool;
  partnerApiKey?: string;
  gatewayDelayMode?: GatewayDelayMode;
  serveStatic?: boolean;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const {
    pool,
    partnerApiKey = config.partnerApiKey,
    gatewayDelayMode = config.gatewayDelayMode,
    serveStatic = true
  } = options;

  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true
  });

  await app.register(fastifyCookie);

  const auth = makeAuthHelpers(pool, partnerApiKey);
  const gateway = new SimulatedGateway(gatewayDelayMode);

  app.addHook('onRequest', async (request) => {
    await auth.attachSession(request);
  });

  app.addHook('onClose', async () => {
    gateway.clearAllTimers();
  });

  app.setErrorHandler(
    (err: Error & { statusCode?: number; code?: string }, request, reply) => {
      if (err.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || err.statusCode === 400) {
        if (request.url.startsWith('/api/partner/')) {
          return reply.code(422).send({ error: 'invalid_request' });
        }
        return reply
          .code(400)
          .send({ error: 'invalid_request', message: err.message });
      }
      request.log.error(err);
      return reply
        .code(err.statusCode ?? 500)
        .send({ error: 'internal_server_error' });
    }
  );

  await registerAuthRoutes(app, pool, auth);
  await registerEventRoutes(app, pool, auth);
  await registerPartnerRoutes(app, pool, auth, gateway);
  await registerPurchaseRoutes(app, pool, auth, gateway);

  if (serveStatic) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontendDist = path.resolve(__dirname, '../../frontend/dist');
    if (fs.existsSync(frontendDist)) {
      await app.register(fastifyStatic, {
        root: frontendDist,
        prefix: '/'
      });

      app.setNotFoundHandler((request, reply) => {
        if (request.url.startsWith('/api/')) {
          return reply.code(404).send({ error: 'not_found' });
        }
        return reply.sendFile('index.html');
      });
    }
  }

  return app;
}
