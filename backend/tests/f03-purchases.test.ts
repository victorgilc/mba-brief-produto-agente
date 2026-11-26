import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { determineGatewayDecision } from '../src/services/gateway.js';
import { ensureTestDatabase, resetTestDatabase } from './test-db.js';

const API_KEY = 'catraca-partner-key-2026';

function futureIso(daysAhead = 30): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function createPublishedEvent(
  app: FastifyInstance,
  orgCookie: string,
  overrides: Partial<{ name: string; capacity: number; priceCents: number }> = {}
): Promise<string> {
  const create = await app.inject({
    method: 'POST',
    url: '/api/organizer/events',
    cookies: { catraca_session: orgCookie },
    payload: {
      name: overrides.name ?? 'Jazz no Porão',
      startsAt: futureIso(30),
      location: 'Porão Central',
      capacity: overrides.capacity ?? 2,
      priceCents: overrides.priceCents ?? 10000
    }
  });
  expect(create.statusCode).toBe(201);
  const eventId = create.json().event.id;

  const pub = await app.inject({
    method: 'POST',
    url: `/api/organizer/events/${eventId}/publish`,
    cookies: { catraca_session: orgCookie }
  });
  expect(pub.statusCode).toBe(200);
  return eventId;
}

describe('F03 - Compras, Concorrência (R07), Gateway Simulado e API de Parceiros', () => {
  let pool: Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = await ensureTestDatabase();
    app = await buildApp({
      pool,
      gatewayDelayMode: 'fast',
      serveStatic: false
    });
  });

  beforeEach(async () => {
    await resetTestDatabase(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('gateway default mode obedece janelas exatas (2-5s rápidos, 30-40s lentos)', () => {
    const d1 = determineGatewayDecision('4000000000000001', 'default');
    expect(d1.outcome).toBe('confirmed');
    expect(d1.delayMs).toBeGreaterThanOrEqual(2000);
    expect(d1.delayMs).toBeLessThanOrEqual(5000);

    const d2 = determineGatewayDecision('4000000000000002', 'default');
    expect(d2.outcome).toBe('declined');
    expect(d2.delayMs).toBeGreaterThanOrEqual(2000);
    expect(d2.delayMs).toBeLessThanOrEqual(5000);

    const d3 = determineGatewayDecision('4000000000000003', 'default');
    expect(d3.outcome).toBe('confirmed');
    expect(d3.delayMs).toBeGreaterThanOrEqual(30000);
    expect(d3.delayMs).toBeLessThanOrEqual(40000);

    const d4 = determineGatewayDecision('4000000000000004', 'default');
    expect(d4.outcome).toBe('declined');
    expect(d4.delayMs).toBeGreaterThanOrEqual(30000);
    expect(d4.delayMs).toBeLessThanOrEqual(40000);

    const dOther = determineGatewayDecision('4000000000009999', 'default');
    expect(dOther.outcome).toBe('declined');
    expect(dOther.delayMs).toBeGreaterThanOrEqual(2000);
    expect(dOther.delayMs).toBeLessThanOrEqual(5000);
  });

  it('R06, R08, R09, CF-02: compra na vitrine nasce pending, confirma via gateway 0001, aparece em Meus ingressos e na API de parceiros', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const partCookie = await loginAs(app, 'participante@catraca.local', 'Part1234!');
    const eventId = await createPublishedEvent(app, orgCookie, { capacity: 2 });

    const buy = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/purchases`,
      cookies: { catraca_session: partCookie },
      payload: { cardNumber: '4000000000000001' }
    });
    expect(buy.statusCode).toBe(202);
    const { ticketId, code, status } = buy.json().ticket;
    expect(status).toBe('pending');
    expect(code).toHaveLength(8);

    const minePending = await app.inject({
      method: 'GET',
      url: '/api/me/tickets',
      cookies: { catraca_session: partCookie }
    });
    expect(minePending.statusCode).toBe(200);
    expect(minePending.json().tickets[0]).toMatchObject({
      ticketId,
      code,
      eventName: 'Jazz no Porão',
      status: 'pending'
    });

    await sleep(200);

    const mineConfirmed = await app.inject({
      method: 'GET',
      url: '/api/me/tickets',
      cookies: { catraca_session: partCookie }
    });
    expect(mineConfirmed.json().tickets[0].status).toBe('confirmed');

    // Cross-channel consultation on Partner API
    const partnerTicket = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${ticketId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(partnerTicket.statusCode).toBe(200);
    expect(partnerTicket.json()).toEqual({
      ticketId,
      code,
      eventId,
      status: 'confirmed',
      checkedIn: false
    });
  });

  it('R05, R06, R07, R08, CF-03: compra pendente ocupa vaga, bloqueia novas compras com 409 sold_out e recusa 0004 libera vaga', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const eventId = await createPublishedEvent(app, orgCookie, { capacity: 1 });

    const slowDecline = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 't2@example.com', cardNumber: '4000000000000004' }
    });
    expect(slowDecline.statusCode).toBe(202);
    const ticketId = slowDecline.json().ticketId;

    // Immediately sold out
    const listNow = await app.inject({
      method: 'GET',
      url: '/api/partner/events',
      headers: { 'x-api-key': API_KEY }
    });
    expect(listNow.json()[0].availableSeats).toBe(0);

    const soldOut = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 't3@example.com', cardNumber: '4000000000000001' }
    });
    expect(soldOut.statusCode).toBe(409);
    expect(soldOut.json()).toEqual({ error: 'sold_out' });

    // Wait for slow card 0004 (450ms in fast mode)
    await sleep(650);

    const ticketAfter = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${ticketId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(ticketAfter.json().status).toBe('declined');

    const listAfter = await app.inject({
      method: 'GET',
      url: '/api/partner/events',
      headers: { 'x-api-key': API_KEY }
    });
    expect(listAfter.json()[0].availableSeats).toBe(1);
  });

  it('API de parceiros segue ordem estrita de erro: 401 -> 422 -> 404 -> 409 e 404 ticket_not_found', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');

    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/organizer/events',
      cookies: { catraca_session: orgCookie },
      payload: {
        name: 'Rascunho',
        startsAt: futureIso(10),
        location: 'Local',
        capacity: 1,
        priceCents: 1000
      }
    });
    const draftId = draftRes.json().event.id;

    // 401 before anything
    const noKey = await app.inject({
      method: 'POST',
      url: '/api/partner/events/evt_none/purchases',
      payload: { cardNumber: '123' }
    });
    expect(noKey.statusCode).toBe(401);
    expect(noKey.json()).toEqual({ error: 'unauthorized' });

    // 422 before 404 (even on nonexistent event)
    const badCard = await app.inject({
      method: 'POST',
      url: '/api/partner/events/evt_none/purchases',
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'ana@example.com', cardNumber: '123' }
    });
    expect(badCard.statusCode).toBe(422);
    expect(badCard.json()).toEqual({ error: 'invalid_request' });

    const badEmail = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${draftId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'invalido', cardNumber: '4000000000000001' }
    });
    expect(badEmail.statusCode).toBe(422);
    expect(badEmail.json()).toEqual({ error: 'invalid_request' });

    // 404 on draft event
    const draftBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${draftId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }
    });
    expect(draftBuy.statusCode).toBe(404);
    expect(draftBuy.json()).toEqual({ error: 'event_not_available' });

    // 404 on missing ticket
    const missingTicket = await app.inject({
      method: 'GET',
      url: '/api/partner/tickets/tkt_missing',
      headers: { 'x-api-key': API_KEY }
    });
    expect(missingTicket.statusCode).toBe(404);
    expect(missingTicket.json()).toEqual({ error: 'ticket_not_found' });
  });

  it('R03, CF-03: edição preserva preço histórico nos ingressos antigos e impede reduzir lotação abaixo da ocupação', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const eventId = await createPublishedEvent(app, orgCookie, {
      capacity: 2,
      priceCents: 10000
    });

    const p1 = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'a@example.com', cardNumber: '4000000000000001' }
    });
    const p2 = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'b@example.com', cardNumber: '4000000000000001' }
    });
    expect(p1.statusCode).toBe(202);
    expect(p2.statusCode).toBe(202);

    // Reject capacity reduction to 1
    const reduceFail = await app.inject({
      method: 'PUT',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: orgCookie },
      payload: {
        name: 'Jazz no Porão',
        startsAt: futureIso(30),
        location: 'Porão Central',
        capacity: 1,
        priceCents: 10000
      }
    });
    expect(reduceFail.statusCode).toBe(409);

    // Increase capacity to 3 and price to 15000
    const updateOk = await app.inject({
      method: 'PUT',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: orgCookie },
      payload: {
        name: 'Jazz no Porão',
        startsAt: futureIso(30),
        location: 'Porão Central',
        capacity: 3,
        priceCents: 15000
      }
    });
    expect(updateOk.statusCode).toBe(200);

    const p3 = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'c@example.com', cardNumber: '4000000000000001' }
    });
    expect(p3.statusCode).toBe(202);

    const prices = await pool.query<{ price_cents: number }>(
      'SELECT price_cents FROM tickets WHERE event_id = $1 ORDER BY created_at ASC',
      [eventId]
    );
    expect(prices.rows.map((r) => r.price_cents)).toEqual([10000, 10000, 15000]);
  });

  it('R07 (Concorrência): 3 rodadas de 30 compras simultâneas em eventos de lotação 5 resultam em exatamente 5x202 e 25x409', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');

    for (let round = 1; round <= 3; round++) {
      const eventId = await createPublishedEvent(app, orgCookie, {
        name: `Carga Rodada ${round}`,
        capacity: 5,
        priceCents: 1000
      });

      const responses = await Promise.all(
        Array.from({ length: 30 }, (_, idx) =>
          app.inject({
            method: 'POST',
            url: `/api/partner/events/${eventId}/purchases`,
            headers: { 'x-api-key': API_KEY },
            payload: {
              buyerEmail: `carga${round}_${idx}@example.com`,
              cardNumber: '4000000000000001'
            }
          })
        )
      );

      const accepted = responses.filter((r) => r.statusCode === 202);
      const soldOut = responses.filter((r) => r.statusCode === 409);

      expect(accepted).toHaveLength(5);
      expect(soldOut).toHaveLength(25);
      for (const r of soldOut) {
        expect(r.json()).toEqual({ error: 'sold_out' });
      }

      const dbCount = await pool.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM tickets WHERE event_id = $1`,
        [eventId]
      );
      expect(dbCount.rows[0].cnt).toBe(5);
    }
  });
});
