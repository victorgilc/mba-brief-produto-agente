import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { ensureTestDatabase, resetTestDatabase } from './test-db.js';

function futureIso(daysAhead = 30): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso(daysAgo = 1): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

async function loginAs(
  app: FastifyInstance,
  email: string,
  password: string
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password }
  });
  expect(res.statusCode).toBe(200);
  return res.cookies.find((c) => c.name === 'catraca_session')!.value;
}

describe('F02 - Gestão de Eventos, Vitrine Pública e API de Parceiros', () => {
  let pool: Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = await ensureTestDatabase();
    app = await buildApp({ pool, serveStatic: false });
  });

  beforeEach(async () => {
    await resetTestDatabase(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('R01: rejeita data no passado, lotação < 1 e preço <= 0 ao criar e ao editar', async () => {
    const cookieA = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');

    const pastCreate = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Show Passado',
        startsAt: pastIso(1),
        location: 'Bar',
        capacity: 10,
        priceCents: 5000
      }
    });
    expect(pastCreate.statusCode).toBe(422);

    const badCap = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Zero Cap',
        startsAt: futureIso(10),
        location: 'Bar',
        capacity: 0,
        priceCents: 5000
      }
    });
    expect(badCap.statusCode).toBe(422);

    const badPrice = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Zero Price',
        startsAt: futureIso(10),
        location: 'Bar',
        capacity: 10,
        priceCents: 0
      }
    });
    expect(badPrice.statusCode).toBe(422);

    const created = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Jazz no Porão',
        startsAt: futureIso(30),
        location: 'Porão Central',
        capacity: 2,
        priceCents: 10000
      }
    });
    expect(created.statusCode).toBe(201);
    const eventId = created.json().event.id;
    expect(created.json().event.status).toBe('draft');

    const pastEdit = await app.inject({
      method: 'PUT',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Jazz no Porão',
        startsAt: pastIso(2),
        location: 'Porão Central',
        capacity: 2,
        priceCents: 10000
      }
    });
    expect(pastEdit.statusCode).toBe(422);
  });

  it('R02: rascunho não aparece na vitrine nem na API; publicado aparece com contrato exato', async () => {
    const cookieA = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');

    const created = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Jazz no Porão',
        startsAt: futureIso(30),
        location: 'Porão Central',
        capacity: 2,
        priceCents: 10000
      }
    });
    const eventId = created.json().event.id;

    const pubBefore = await app.inject({ method: 'GET', url: '/api/events' });
    expect(pubBefore.json().events).toHaveLength(0);

    const partnerBefore = await app.inject({
      method: 'GET',
      url: '/api/partner/events',
      headers: { 'x-api-key': 'catraca-partner-key-2026' }
    });
    expect(partnerBefore.statusCode).toBe(200);
    expect(partnerBefore.json()).toEqual([]);

    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/publish`,
      cookies: { catraca_session: cookieA }
    });
    expect(publishRes.statusCode).toBe(200);
    expect(publishRes.json().event.status).toBe('published');

    const pubAfter = await app.inject({ method: 'GET', url: '/api/events' });
    expect(pubAfter.json().events).toHaveLength(1);
    expect(pubAfter.json().events[0].id).toBe(eventId);

    const partnerAfter = await app.inject({
      method: 'GET',
      url: '/api/partner/events',
      headers: { 'x-api-key': 'catraca-partner-key-2026' }
    });
    expect(partnerAfter.statusCode).toBe(200);
    expect(partnerAfter.json()).toHaveLength(1);
    expect(partnerAfter.json()[0]).toEqual({
      id: eventId,
      name: 'Jazz no Porão',
      startsAt: expect.any(String),
      priceCents: 10000,
      availableSeats: 2
    });
  });

  it('R03: aceita aumento de lotação e alteração de preço; rejeita edição abaixo de vagas ocupadas', async () => {
    const cookieA = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');

    const created = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Workshop Node',
        startsAt: futureIso(20),
        location: 'Sala 1',
        capacity: 2,
        priceCents: 10000
      }
    });
    const eventId = created.json().event.id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Workshop Node Avançado',
        startsAt: futureIso(25),
        location: 'Sala 2',
        capacity: 5,
        priceCents: 15000
      }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().event.capacity).toBe(5);
    expect(updated.json().event.priceCents).toBe(15000);

    // Simula 3 vagas ocupadas para comprovar rejeição de redução abaixo da ocupação (R03)
    await pool.query(
      `
      INSERT INTO tickets (id, code, event_id, buyer_email, channel, price_cents, status, card_last4)
      VALUES
        ('t1', 'CODE0001', $1, 'a@ex.com', 'partner', 15000, 'confirmed', '0001'),
        ('t2', 'CODE0002', $1, 'b@ex.com', 'partner', 15000, 'pending', '0003'),
        ('t3', 'CODE0003', $1, 'c@ex.com', 'partner', 15000, 'confirmed', '0001')
      `,
      [eventId]
    );

    const reduceBelow = await app.inject({
      method: 'PUT',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Workshop Node Avançado',
        startsAt: futureIso(25),
        location: 'Sala 2',
        capacity: 2,
        priceCents: 15000
      }
    });
    expect(reduceBelow.statusCode).toBe(409);
    expect(reduceBelow.json().error).toBe('capacity_below_occupied');
  });

  it('R04, R13, CF-01: isolamento estrito entre Organizador A, Organizador B, Participante, Visitante e X-Api-Key', async () => {
    const cookieA = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const cookieB = await loginAs(app, 'org.b@catraca.local', 'OrgB1234!');
    const cookiePart = await loginAs(app, 'participante@catraca.local', 'Part1234!');

    const created = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'Evento Secreto de A',
        startsAt: futureIso(30),
        location: 'Clube A',
        capacity: 10,
        priceCents: 8000
      }
    });
    const eventIdA = created.json().event.id;

    const listB = await app.inject({
      method: 'GET',
      url: '/api/organizer/events',
      cookies: { catraca_session: cookieB }
    });
    expect(listB.statusCode).toBe(200);
    expect(listB.json().events).toEqual([]);

    const getB = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${eventIdA}`,
      cookies: { catraca_session: cookieB }
    });
    expect(getB.statusCode).toBe(404);
    expect(getB.body).not.toContain('Evento Secreto de A');

    const getPart = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${eventIdA}`,
      cookies: { catraca_session: cookiePart }
    });
    expect(getPart.statusCode).toBe(403);
    expect(getPart.body).not.toContain('Evento Secreto de A');

    const getVisitor = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${eventIdA}`
    });
    expect(getVisitor.statusCode).toBe(401);

    const partnerNoKey = await app.inject({
      method: 'GET',
      url: '/api/partner/events'
    });
    expect(partnerNoKey.statusCode).toBe(401);
    expect(partnerNoKey.json()).toEqual({ error: 'unauthorized' });

    const partnerBadKey = await app.inject({
      method: 'GET',
      url: '/api/partner/events',
      headers: { 'x-api-key': 'wrong' }
    });
    expect(partnerBadKey.statusCode).toBe(401);
    expect(partnerBadKey.json()).toEqual({ error: 'unauthorized' });
  });
});
