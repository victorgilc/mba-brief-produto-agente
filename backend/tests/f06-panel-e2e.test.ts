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

describe('F06 - Painel Consolidado de Métricas e Receita + E2E Cross-Feature', () => {
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

  it('CF-09, CF-10, R03, R10, R12: painel soma vitrine + API, usa preço histórico por compra e incrementa check-ins mantendo Confirmados', async () => {
    const cookieA = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const cookiePart = await loginAs(app, 'participante@catraca.local', 'Part1234!');

    const e1 = await createPublishedEvent(app, cookieA, {
      name: 'E1',
      capacity: 2,
      priceCents: 10000
    });

    // 1 compra pela vitrine (R$ 100) + 1 compra pela API (R$ 100)
    const webBuy = await app.inject({
      method: 'POST',
      url: `/api/events/${e1}/purchases`,
      cookies: { catraca_session: cookiePart },
      payload: { cardNumber: '4000000000000001' }
    });
    expect(webBuy.statusCode).toBe(202);
    const c1 = webBuy.json().ticket.code;

    const apiBuy1 = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${e1}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'p1@example.com', cardNumber: '4000000000000001' }
    });
    expect(apiBuy1.statusCode).toBe(202);

    await sleep(200);

    // Muda preço para R$ 150,00 e lotação para 3
    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/organizer/events/${e1}`,
      cookies: { catraca_session: cookieA },
      payload: {
        name: 'E1',
        startsAt: futureIso(30),
        location: 'Porão Central',
        capacity: 3,
        priceCents: 15000
      }
    });
    expect(editRes.statusCode).toBe(200);

    // 3ª compra a R$ 150,00
    const apiBuy2 = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${e1}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'p2@example.com', cardNumber: '4000000000000001' }
    });
    expect(apiBuy2.statusCode).toBe(202);

    await sleep(200);

    const panel1 = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${e1}/panel`,
      cookies: { catraca_session: cookieA }
    });
    expect(panel1.statusCode).toBe(200);
    expect(panel1.json()).toEqual({
      eventId: e1,
      confirmed: 3,
      pending: 0,
      checkedIn: 0,
      availableSeats: 0,
      revenueCents: 35000,
      refunded: 0
    });

    // Check-in de C1 -> Check-ins sobe para 1, Confirmados continua 3
    const checkinRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${e1}/checkin`,
      cookies: { catraca_session: cookieA },
      payload: { code: c1 }
    });
    expect(checkinRes.statusCode).toBe(200);
    expect(checkinRes.json().message).toBe('Entrada liberada');

    const panel2 = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${e1}/panel`,
      cookies: { catraca_session: cookieA }
    });
    expect(panel2.json()).toEqual({
      eventId: e1,
      confirmed: 3,
      pending: 0,
      checkedIn: 1,
      availableSeats: 0,
      revenueCents: 35000,
      refunded: 0
    });
  });

  it('CF-11, R05, R10, R11, R12: painel em evento cancelado zera confirmados/pendentes/vagas/receita e contabiliza estornados mesmo após gateway tardio', async () => {
    const cookieA = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');

    const e3 = await createPublishedEvent(app, cookieA, {
      name: 'E3',
      capacity: 5,
      priceCents: 5000
    });

    // T5 lento (0003) e T6 rápido (0001)
    const t5 = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${e3}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 't5@example.com', cardNumber: '4000000000000003' }
    });
    const t6 = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${e3}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 't6@example.com', cardNumber: '4000000000000001' }
    });
    const c6 = t6.json().code;

    // Aguarda T6 confirmar (60ms) enquanto T5 continua pending (450ms)
    await sleep(160);

    const panelBeforeCancel = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${e3}/panel`,
      cookies: { catraca_session: cookieA }
    });
    expect(panelBeforeCancel.json()).toEqual({
      eventId: e3,
      confirmed: 1,
      pending: 1,
      checkedIn: 0,
      availableSeats: 3,
      revenueCents: 5000,
      refunded: 0
    });

    // Cancela E3 antes do gateway lento resolver T5
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${e3}/cancel`,
      cookies: { catraca_session: cookieA }
    });
    expect(cancelRes.statusCode).toBe(200);

    // Aguarda além da janela lenta (450ms)
    await sleep(600);

    const t5After = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${t5.json().ticketId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(t5After.json().status).toBe('cancelled');

    const checkinCancelled = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${e3}/checkin`,
      cookies: { catraca_session: cookieA },
      payload: { code: c6 }
    });
    expect(checkinCancelled.json().message).toBe('Evento cancelado');

    const panelAfter = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${e3}/panel`,
      cookies: { catraca_session: cookieA }
    });
    expect(panelAfter.json()).toEqual({
      eventId: e3,
      confirmed: 0,
      pending: 0,
      checkedIn: 0,
      availableSeats: 0,
      revenueCents: 0,
      refunded: 1
    });
  });

  it('CF-08, R13: isolamento do painel bloqueia Organizador B, Participante e Visitante', async () => {
    const cookieA = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const cookieB = await loginAs(app, 'org.b@catraca.local', 'OrgB1234!');
    const cookiePart = await loginAs(app, 'participante@catraca.local', 'Part1234!');

    const e1 = await createPublishedEvent(app, cookieA, {
      name: 'Evento Privado Painel',
      capacity: 10,
      priceCents: 5000
    });

    const orgBRes = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${e1}/panel`,
      cookies: { catraca_session: cookieB }
    });
    expect(orgBRes.statusCode).toBe(404);
    expect(orgBRes.body).not.toContain('revenueCents');

    const partRes = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${e1}/panel`,
      cookies: { catraca_session: cookiePart }
    });
    expect(partRes.statusCode).toBe(403);

    const visitorRes = await app.inject({
      method: 'GET',
      url: `/api/organizer/events/${e1}/panel`
    });
    expect(visitorRes.statusCode).toBe(401);
  });
});
