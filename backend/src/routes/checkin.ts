import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { makeAuthHelpers } from '../middleware/auth.js';
import { checkinInputSchema, performCheckin } from '../services/checkin.js';
import { DomainError } from '../services/events.js';

export async function registerCheckinRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>
): Promise<void> {
  app.post<{ Params: { eventId: string } }>(
    '/api/organizer/events/:eventId/checkin',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      const parsed = checkinInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: 'invalid_request',
          message:
            parsed.error.issues[0]?.message ?? 'Código do ingresso é obrigatório'
        });
      }

      try {
        const result = await performCheckin(
          pool,
          request.authUser!.id,
          request.params.eventId,
          parsed.data.code
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
