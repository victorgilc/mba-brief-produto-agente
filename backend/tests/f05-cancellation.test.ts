import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
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

async function createEvent(
  app: FastifyInstance,
  orgCookie: string,
  overrides: Partial<{ name: string; capacity: number; priceCents: number }> = {}
): Promise<string> {
  const create = await app.inject({
    method: 'POST',
    url: '/api/organizer/events',
    cookies: { catraca_session: orgCookie },
    payload: {
      name: overrides.name ?? 'Festival Cancelável',
      startsAt: futureIso(30),
      location: 'Galpão Cultural',
      capacity: overrides.capacity ?? 5,
      priceCents: overrides.priceCents ?? 5000
    }
  });
  expect(create.statusCode).toBe(201);
  return create.json().event.id;
}

async function createPublishedEvent(
  app: FastifyInstance,
  orgCookie: string,
  overrides: Partial<{ name: string; capacity: number; priceCents: number }> = {}
): Promise<string> {
  const eventId = await createEvent(app, orgCookie, overrides);
  const pub = await app.inject({
    method: 'POST',
    url: `/api/organizer/events/${eventId}/publish`,
    cookies: { catraca_session: orgCookie }
  });
  expect(pub.statusCode).toBe(200);
  return eventId;
}

describe('F05 - Cancelamento Irreversível de Eventos e Reconciliação com Gateway (R11)', () => {
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

  it('R02, R05, R11, CF-06: cancelar evento publicado remove da vitrine e API, zera vagas e bloqueia compras, edição e republicação', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const partCookie = await loginAs(app, 'participante@catraca.local', 'Part1234!');
    const eventId = await createPublishedEvent(app, orgCookie, {
      name: 'Show E3',
      capacity: 5,
      priceCents: 5000
    });

    // Appears in both channels before cancellation
    const publicBefore = await app.inject({ method: 'GET', url: '/api/events' });
    expect(publicBefore.statusCode).toBe(200);
    expect(
      publicBefore.json().events.some((e: { id: string }) => e.id === eventId)
    ).toBe(true);

    const partnerBefore = await app.inject({
      method: 'GET',
      url: '/api/partner/events',
      headers: { 'x-api-key': API_KEY }
    });
    expect(partnerBefore.statusCode).toBe(200);
    expect(
      partnerBefore.json().some((e: { id: string }) => e.id === eventId)
    ).toBe(true);

    // Cancel event
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/cancel`,
      cookies: { catraca_session: orgCookie }
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json()).toMatchObject({
      event: {
        id: eventId,
        status: 'cancelled',
        occupiedSeats: 0,
        availableSeats: 0
      },
      refundedCount: 0,
      cancelledCount: 0
    });

    // Removed from public storefront and partner events
    const publicAfter = await app.inject({ method: 'GET', url: '/api/events' });
    expect(publicAfter.statusCode).toBe(200);
    expect(
      publicAfter.json().events.some((e: { id: string }) => e.id === eventId)
    ).toBe(false);

    const partnerAfter = await app.inject({
      method: 'GET',
      url: '/api/partner/events',
      headers: { 'x-api-key': API_KEY }
    });
    expect(partnerAfter.statusCode).toBe(200);
    expect(
      partnerAfter.json().some((e: { id: string }) => e.id === eventId)
    ).toBe(false);

    // Organizer detail reports cancelled and 0 availableSeats
    const detailAfter = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: orgCookie }
    });
    expect(detailAfter.statusCode).toBe(200);
    expect(detailAfter.json().event.status).toBe('cancelled');
    expect(detailAfter.json().event.availableSeats).toBe(0);

    // Partner purchase blocked with exact 404 event_not_available
    const partnerBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 'comprador@example.com',
        cardNumber: '4000000000000001'
      }
    });
    expect(partnerBuy.statusCode).toBe(404);
    expect(partnerBuy.json()).toEqual({ error: 'event_not_available' });

    // Web storefront purchase blocked with 404 event_not_available
    const webBuy = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/purchases`,
      cookies: { catraca_session: partCookie },
      payload: { cardNumber: '4000000000000001' }
    });
    expect(webBuy.statusCode).toBe(404);
    expect(webBuy.json().error).toBe('event_not_available');

    // Edit blocked with 409
    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: orgCookie },
      payload: {
        name: 'Show E3 Editado',
        startsAt: futureIso(40),
        location: 'Outro Local',
        capacity: 10,
        priceCents: 6000
      }
    });
    expect(editRes.statusCode).toBe(409);
    expect(editRes.json().error).toBe('event_cancelled');

    // Republish blocked with 409
    const republishRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/publish`,
      cookies: { catraca_session: orgCookie }
    });
    expect(republishRes.statusCode).toBe(409);
    expect(republishRes.json().error).toBe('event_cancelled');
  });

  it('R11, CF-07: ingressos confirmados (vitrine + API) viram refunded, pendentes (0003/0004) viram cancelled e callback tardio do gateway não altera status final', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const partCookie = await loginAs(app, 'participante@catraca.local', 'Part1234!');
    const eventId = await createPublishedEvent(app, orgCookie, {
      name: 'Show E3b Gateway Tardio',
      capacity: 6,
      priceCents: 5000
    });

    // 1. Confirmed tickets on both channels (fast card 0001) + one fast declined (0002)
    const webConfirmedBuy = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/purchases`,
      cookies: { catraca_session: partCookie },
      payload: { cardNumber: '4000000000000001' }
    });
    expect(webConfirmedBuy.statusCode).toBe(202);
    const webConfirmedId = webConfirmedBuy.json().ticket.ticketId;

    const partnerConfirmedBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 't6@example.com',
        cardNumber: '4000000000000001'
      }
    });
    expect(partnerConfirmedBuy.statusCode).toBe(202);
    const partnerConfirmedId = partnerConfirmedBuy.json().ticketId;

    const partnerDeclinedBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 'declined@example.com',
        cardNumber: '4000000000000002'
      }
    });
    expect(partnerDeclinedBuy.statusCode).toBe(202);
    const partnerDeclinedId = partnerDeclinedBuy.json().ticketId;

    // Wait for fast gateway cards (60ms in fast mode) to settle
    await sleep(200);

    for (const tid of [webConfirmedId, partnerConfirmedId]) {
      const check = await app.inject({
        method: 'GET',
        url: `/api/partner/tickets/${tid}`,
        headers: { 'x-api-key': API_KEY }
      });
      expect(check.statusCode).toBe(200);
      expect(check.json().status).toBe('confirmed');
    }

    const declinedBefore = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${partnerDeclinedId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(declinedBefore.json().status).toBe('declined');

    // 2. Slow pending tickets (0003 slow-approve and 0004 slow-decline: 450ms in fast mode)
    const slowApproveBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 't5@example.com',
        cardNumber: '4000000000000003'
      }
    });
    expect(slowApproveBuy.statusCode).toBe(202);
    const slowApproveId = slowApproveBuy.json().ticketId;

    const slowDeclineBuy = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/purchases`,
      cookies: { catraca_session: partCookie },
      payload: { cardNumber: '4000000000000004' }
    });
    expect(slowDeclineBuy.statusCode).toBe(202);
    const slowDeclineId = slowDeclineBuy.json().ticket.ticketId;

    // 3. Cancel immediately while slow tickets are still pending
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/cancel`,
      cookies: { catraca_session: orgCookie }
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json()).toMatchObject({
      event: {
        id: eventId,
        status: 'cancelled',
        occupiedSeats: 0,
        availableSeats: 0
      },
      refundedCount: 2,
      cancelledCount: 2
    });

    // Immediately verify transitions
    for (const tid of [webConfirmedId, partnerConfirmedId]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/partner/tickets/${tid}`,
        headers: { 'x-api-key': API_KEY }
      });
      expect(res.json().status).toBe('refunded');
    }

    for (const tid of [slowApproveId, slowDeclineId]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/partner/tickets/${tid}`,
        headers: { 'x-api-key': API_KEY }
      });
      expect(res.json().status).toBe('cancelled');
    }

    // Declined ticket remains declined
    const declinedAfter = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${partnerDeclinedId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(declinedAfter.json().status).toBe('declined');

    // Participant "Meus ingressos" reflects refunded and cancelled
    const myTicketsImmediate = await app.inject({
      method: 'GET',
      url: '/api/me/tickets',
      cookies: { catraca_session: partCookie }
    });
    expect(myTicketsImmediate.statusCode).toBe(200);
    const ticketMapImmediate = new Map<string, string>(
      myTicketsImmediate
        .json()
        .tickets.map((t: { ticketId: string; status: string }) => [
          t.ticketId,
          t.status
        ])
    );
    expect(ticketMapImmediate.get(webConfirmedId)).toBe('refunded');
    expect(ticketMapImmediate.get(slowDeclineId)).toBe('cancelled');

    // 4. Wait well past slow gateway delay (450ms in fast mode -> wait 700ms)
    await sleep(700);

    // Late gateway callbacks for 0003 (confirmed) and 0004 (declined) MUST NOT overwrite cancelled/refunded
    for (const tid of [slowApproveId, slowDeclineId]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/partner/tickets/${tid}`,
        headers: { 'x-api-key': API_KEY }
      });
      expect(res.json().status).toBe('cancelled');
    }

    for (const tid of [webConfirmedId, partnerConfirmedId]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/partner/tickets/${tid}`,
        headers: { 'x-api-key': API_KEY }
      });
      expect(res.json().status).toBe('refunded');
    }

    const declinedLate = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${partnerDeclinedId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(declinedLate.json().status).toBe('declined');
  });

  it('R13: isolamento por organizador e RBAC no cancelamento (Org B -> 404, Participante -> 403, Visitante -> 401)', async () => {
    const orgACookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const orgBCookie = await loginAs(app, 'org.b@catraca.local', 'OrgB1234!');
    const partCookie = await loginAs(app, 'participante@catraca.local', 'Part1234!');

    const eventId = await createPublishedEvent(app, orgACookie, {
      name: 'Evento Privado de A'
    });

    // Organizer B gets 404
    const orgBRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/cancel`,
      cookies: { catraca_session: orgBCookie }
    });
    expect(orgBRes.statusCode).toBe(404);
    expect(orgBRes.json().error).toBe('event_not_found');

    // Participant gets 403
    const partRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/cancel`,
      cookies: { catraca_session: partCookie }
    });
    expect(partRes.statusCode).toBe(403);
    expect(partRes.json().error).toBe('forbidden');

    // Visitor gets 401
    const visitorRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/cancel`
    });
    expect(visitorRes.statusCode).toBe(401);
    expect(visitorRes.json().error).toBe('unauthorized');

    // Event of Organizer A remains published
    const detail = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${eventId}`,
      cookies: { catraca_session: orgACookie }
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().event.status).toBe('published');
  });

  it('R11: evento em rascunho ou já cancelado não pode ser cancelado (409)', async () => {
    const orgCookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');

    // Draft cannot be cancelled
    const draftId = await createEvent(app, orgCookie, { name: 'Rascunho' });
    const cancelDraft = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${draftId}/cancel`,
      cookies: { catraca_session: orgCookie }
    });
    expect(cancelDraft.statusCode).toBe(409);
    expect(cancelDraft.json().error).toBe('event_cannot_be_cancelled');

    const draftCheck = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${draftId}`,
      cookies: { catraca_session: orgCookie }
    });
    expect(draftCheck.json().event.status).toBe('draft');

    // Already cancelled cannot be cancelled again
    const pubId = await createPublishedEvent(app, orgCookie, {
      name: 'Publicado Uma Vez'
    });
    const firstCancel = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${pubId}/cancel`,
      cookies: { catraca_session: orgCookie }
    });
    expect(firstCancel.statusCode).toBe(200);

    const secondCancel = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${pubId}/cancel`,
      cookies: { catraca_session: orgCookie }
    });
    expect(secondCancel.statusCode).toBe(409);
    expect(secondCancel.json().error).toBe('event_cannot_be_cancelled');
  });
});
