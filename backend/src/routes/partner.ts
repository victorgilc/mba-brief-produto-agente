import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { makeAuthHelpers } from '../middleware/auth.js';
import { DomainError, listPublicEvents } from '../services/events.js';
import { SimulatedGateway } from '../services/gateway.js';
import {
  getPartnerTicket,
  partnerPurchaseSchema,
  purchaseTicket
} from '../services/purchases.js';

export async function registerPartnerRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>,
  gateway: SimulatedGateway
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

  app.post<{ Params: { eventId: string } }>(
    '/api/partner/events/:eventId/purchases',
    { preHandler: auth.requirePartnerApiKey },
    async (request, reply) => {
      // Fixed error precedence after X-Api-Key: 422 invalid_request -> 404 event_not_available -> 409 sold_out
      const parsed = partnerPurchaseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: 'invalid_request' });
      }

      try {
        const result = await purchaseTicket(pool, gateway, {
          eventId: request.params.eventId,
          buyerEmail: parsed.data.buyerEmail,
          cardNumber: parsed.data.cardNumber,
          userId: null,
          channel: 'partner'
        });
        return reply.code(202).send(result);
      } catch (err) {
        if (err instanceof DomainError) {
          return reply.code(err.statusCode).send({ error: err.code });
        }
        throw err;
      }
    }
  );

  app.get<{ Params: { ticketId: string } }>(
    '/api/partner/tickets/:ticketId',
    { preHandler: auth.requirePartnerApiKey },
    async (request, reply) => {
      try {
        const ticket = await getPartnerTicket(pool, request.params.ticketId);
        return reply.code(200).send(ticket);
      } catch (err) {
        if (err instanceof DomainError) {
          return reply.code(err.statusCode).send({ error: err.code });
        }
        throw err;
      }
    }
  );
}
