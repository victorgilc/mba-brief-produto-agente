import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { makeAuthHelpers } from '../middleware/auth.js';
import {
  createEvent,
  DomainError,
  getOrganizerEvent,
  listOrganizerEvents,
  listPublicEvents,
  publishEvent,
  updateEvent
} from '../services/events.js';

export async function registerEventRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>
): Promise<void> {
  app.get('/api/events', async (_request, reply) => {
    const events = await listPublicEvents(pool);
    return reply.code(200).send({
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        startsAt: e.startsAt,
        location: e.location,
        priceCents: e.priceCents,
        capacity: e.capacity,
        availableSeats: e.availableSeats
      }))
    });
  });

  app.get(
    '/api/organizer/events',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      const events = await listOrganizerEvents(pool, request.authUser!.id);
      return reply.code(200).send({ events });
    }
  );

  app.post(
    '/api/organizer/events',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      try {
        const event = await createEvent(pool, request.authUser!.id, request.body);
        return reply.code(201).send({ event });
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

  app.get<{ Params: { eventId: string } }>(
    '/api/organizer/events/:eventId',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      try {
        const event = await getOrganizerEvent(
          pool,
          request.authUser!.id,
          request.params.eventId
        );
        return reply.code(200).send({ event });
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

  app.put<{ Params: { eventId: string } }>(
    '/api/organizer/events/:eventId',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      try {
        const event = await updateEvent(
          pool,
          request.authUser!.id,
          request.params.eventId,
          request.body
        );
        return reply.code(200).send({ event });
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

  app.post<{ Params: { eventId: string } }>(
    '/api/organizer/events/:eventId/publish',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      try {
        const event = await publishEvent(
          pool,
          request.authUser!.id,
          request.params.eventId
        );
        return reply.code(200).send({ event });
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
