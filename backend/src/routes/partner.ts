import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { makeAuthHelpers } from '../middleware/auth.js';
import { listPublicEvents } from '../services/events.js';

export async function registerPartnerRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>
): Promise<void> {
  app.get(
    '/api/partner/events',
    { preHandler: auth.requirePartnerApiKey },
    async (_request, reply) => {
      const events = await listPublicEvents(pool);
      return reply.code(200).send(
        events.map((e) => ({
          id: e.id,
          name: e.name,
          startsAt: e.startsAt,
          priceCents: e.priceCents,
          availableSeats: e.availableSeats
        }))
      );
    }
  );
}
