import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { makeAuthHelpers } from '../middleware/auth.js';
import { cancelEvent } from '../services/cancellation.js';
import { DomainError } from '../services/events.js';

export async function registerCancellationRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>
): Promise<void> {
  app.post<{ Params: { eventId: string } }>(
    '/api/organizer/events/:eventId/cancel',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      try {
        const result = await cancelEvent(
          pool,
          request.authUser!.id,
          request.params.eventId
        );
        return reply.code(200).send(result);
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
