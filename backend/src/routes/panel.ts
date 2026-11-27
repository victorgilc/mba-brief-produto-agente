import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { makeAuthHelpers } from '../middleware/auth.js';
import { DomainError } from '../services/events.js';
import { getEventPanel } from '../services/panel.js';

export async function registerPanelRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>
): Promise<void> {
  app.get<{ Params: { eventId: string } }>(
    '/api/organizer/events/:eventId/panel',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      try {
        const panel = await getEventPanel(
          pool,
          request.authUser!.id,
          request.params.eventId
        );
        return reply.code(200).send(panel);
      } catch (err) {
        if (err instanceof DomainError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );
}
