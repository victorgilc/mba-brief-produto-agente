import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { makeAuthHelpers } from '../middleware/auth.js';
import { DomainError } from '../services/events.js';
import { SimulatedGateway } from '../services/gateway.js';
import {
  listUserTickets,
  purchaseTicket,
  webPurchaseSchema
} from '../services/purchases.js';

export async function registerPurchaseRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>,
  gateway: SimulatedGateway
): Promise<void> {
  app.post<{ Params: { eventId: string } }>(
    '/api/events/:eventId/purchases',
    { preHandler: auth.requireParticipant },
    async (request, reply) => {
      const parsed = webPurchaseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: 'invalid_request',
          message:
            parsed.error.issues[0]?.message ??
            'O número do cartão deve ter exatamente 16 dígitos'
        });
      }

      try {
        const ticket = await purchaseTicket(pool, gateway, {
          eventId: request.params.eventId,
          buyerEmail: request.authUser!.email,
          cardNumber: parsed.data.cardNumber,
          userId: request.authUser!.id,
          channel: 'web'
        });
        return reply.code(202).send({ ticket });
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

  app.get(
    '/api/me/tickets',
    { preHandler: auth.requireParticipant },
    async (request, reply) => {
      const tickets = await listUserTickets(pool, request.authUser!.id);
      return reply.code(200).send({ tickets });
    }
  );
}
