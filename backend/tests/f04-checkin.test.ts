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
      name: overrides.name ?? 'Show Acústico',
      startsAt: futureIso(30),
      location: 'Bar Central',
      capacity: overrides.capacity ?? 10,
      priceCents: overrides.priceCents ?? 8000
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

describe('F04 - Check-in de Ingressos na Página de Gestão (R10, R13)', () => {
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

  it('R10, CF-05: valida ingresso confirmado da vitrine e da API, atualiza checkedIn sem alterar status e rejeita reuso', async () => {
    const orgACookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const partCookie = await loginAs(app, 'participante@catraca.local', 'Part1234!');
    const eventId = await createPublishedEvent(app, orgACookie);

    // 1. Ingresso confirmado via vitrine
    const webBuy = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/purchases`,
      cookies: { catraca_session: partCookie },
      payload: { cardNumber: '4000000000000001' }
    });
    expect(webBuy.statusCode).toBe(202);
    const webTicket = webBuy.json().ticket as { ticketId: string; code: string };

    // 2. Ingresso confirmado via API de parceiros
    const partnerBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 'parceiro@example.com',
        cardNumber: '4000000000000001'
      }
    });
    expect(partnerBuy.statusCode).toBe(202);
    const partnerTicket = partnerBuy.json() as { ticketId: string; code: string };

    await sleep(200);

    // Check-in do ingresso da vitrine (testando trim e normalização para maiúsculas)
    const webCheckin = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: `  ${webTicket.code.toLowerCase()}  ` }
    });
    expect(webCheckin.statusCode).toBe(200);
    expect(webCheckin.json()).toEqual({
      ok: true,
      reason: 'checked_in',
      message: 'Entrada liberada'
    });

    // GET /api/partner/tickets/:ticketId mostra checkedIn: true e status permanece "confirmed"
    const webTicketStatus = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${webTicket.ticketId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(webTicketStatus.statusCode).toBe(200);
    expect(webTicketStatus.json()).toEqual({
      ticketId: webTicket.ticketId,
      code: webTicket.code,
      eventId,
      status: 'confirmed',
      checkedIn: true
    });

    // Segunda tentativa com o mesmo código -> Ingresso já utilizado
    const webCheckinAgain = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: webTicket.code }
    });
    expect(webCheckinAgain.statusCode).toBe(200);
    expect(webCheckinAgain.json()).toEqual({
      ok: false,
      reason: 'already_checked_in',
      message: 'Ingresso já utilizado'
    });

    // Check-in do ingresso da API de parceiros
    const partnerCheckin = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: partnerTicket.code }
    });
    expect(partnerCheckin.statusCode).toBe(200);
    expect(partnerCheckin.json()).toEqual({
      ok: true,
      reason: 'checked_in',
      message: 'Entrada liberada'
    });

    const partnerTicketStatus = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${partnerTicket.ticketId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(partnerTicketStatus.statusCode).toBe(200);
    expect(partnerTicketStatus.json()).toEqual({
      ticketId: partnerTicket.ticketId,
      code: partnerTicket.code,
      eventId,
      status: 'confirmed',
      checkedIn: true
    });

    const partnerCheckinAgain = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: partnerTicket.code }
    });
    expect(partnerCheckinAgain.statusCode).toBe(200);
    expect(partnerCheckinAgain.json()).toEqual({
      ok: false,
      reason: 'already_checked_in',
      message: 'Ingresso já utilizado'
    });
  });

  it('R10: rejeita ingresso pendente, ingresso recusado e código inexistente com mensagens literais', async () => {
    const orgACookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const eventId = await createPublishedEvent(app, orgACookie);

    // Ingresso lento (0003) ainda pending imediatamente após compra
    const pendingBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 'pending@example.com',
        cardNumber: '4000000000000003'
      }
    });
    expect(pendingBuy.statusCode).toBe(202);
    const pendingCode = pendingBuy.json().code as string;

    const pendingCheckin = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: pendingCode }
    });
    expect(pendingCheckin.statusCode).toBe(200);
    expect(pendingCheckin.json()).toEqual({
      ok: false,
      reason: 'ticket_not_confirmed',
      message: 'Ingresso não confirmado'
    });

    // Ingresso recusado (0002)
    const declinedBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 'declined@example.com',
        cardNumber: '4000000000000002'
      }
    });
    expect(declinedBuy.statusCode).toBe(202);
    const declinedCode = declinedBuy.json().code as string;

    await sleep(200);

    const declinedCheckin = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: declinedCode }
    });
    expect(declinedCheckin.statusCode).toBe(200);
    expect(declinedCheckin.json()).toEqual({
      ok: false,
      reason: 'ticket_not_confirmed',
      message: 'Ingresso não confirmado'
    });

    // Código inexistente
    const invalidCheckin = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: 'ZZZZZZZZ' }
    });
    expect(invalidCheckin.statusCode).toBe(200);
    expect(invalidCheckin.json()).toEqual({
      ok: false,
      reason: 'invalid_ticket',
      message: 'Ingresso inválido para este evento'
    });

    // Código vazio -> 422 invalid_request
    const emptyCode = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: '   ' }
    });
    expect(emptyCode.statusCode).toBe(422);
    expect(emptyCode.json().error).toBe('invalid_request');
  });

  it('R10 precedência estrita em evento cancelado: regra 1 (inválido) > regra 2 (Evento cancelado) > regras 3 e 4', async () => {
    const orgACookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const eventId = await createPublishedEvent(app, orgACookie);

    // Ingresso confirmado que já passou por check-in antes do cancelamento
    const confirmedBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 'used@example.com',
        cardNumber: '4000000000000001'
      }
    });
    const usedCode = confirmedBuy.json().code as string;

    // Ingresso recusado (não confirmado)
    const declinedBuy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: {
        buyerEmail: 'declined2@example.com',
        cardNumber: '4000000000000002'
      }
    });
    const declinedCode = declinedBuy.json().code as string;

    await sleep(200);

    // Realiza check-in do ingresso confirmado enquanto o evento ainda está publicado
    const firstCheckin = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: usedCode }
    });
    expect(firstCheckin.json().reason).toBe('checked_in');

    // Simula cancelamento do evento no banco (estornando o confirmado)
    await pool.query(`UPDATE events SET status = 'cancelled' WHERE id = $1`, [
      eventId
    ]);
    await pool.query(
      `UPDATE tickets SET status = 'refunded' WHERE event_id = $1 AND status = 'confirmed'`,
      [eventId]
    );

    // Regra 1 antes de regra 2: código inexistente ainda retorna "Ingresso inválido para este evento"
    const missingOnCancelled = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: 'ZZZZZZZZ' }
    });
    expect(missingOnCancelled.statusCode).toBe(200);
    expect(missingOnCancelled.json()).toEqual({
      ok: false,
      reason: 'invalid_ticket',
      message: 'Ingresso inválido para este evento'
    });

    // Regra 2 antes de regra 3 (declined): retorna "Evento cancelado"
    const declinedOnCancelled = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: declinedCode }
    });
    expect(declinedOnCancelled.statusCode).toBe(200);
    expect(declinedOnCancelled.json()).toEqual({
      ok: false,
      reason: 'event_cancelled',
      message: 'Evento cancelado'
    });

    // Regra 2 antes de regra 3/4 (refunded + checked_in = true): retorna "Evento cancelado"
    const usedOnCancelled = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventId}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: usedCode }
    });
    expect(usedOnCancelled.statusCode).toBe(200);
    expect(usedOnCancelled.json()).toEqual({
      ok: false,
      reason: 'event_cancelled',
      message: 'Evento cancelado'
    });
  });

  it('R10, R13, CF-04: código de evento do Organizador B é inválido no evento de A, e isolamento bloqueia Organizador B, participante e visitante', async () => {
    const orgACookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const orgBCookie = await loginAs(app, 'org.b@catraca.local', 'OrgB1234!');
    const partCookie = await loginAs(app, 'participante@catraca.local', 'Part1234!');

    const eventA = await createPublishedEvent(app, orgACookie, { name: 'Evento A' });
    const eventB = await createPublishedEvent(app, orgBCookie, { name: 'Evento B' });

    const buyA = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventA}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'a@example.com', cardNumber: '4000000000000001' }
    });
    const buyB = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventB}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'b@example.com', cardNumber: '4000000000000001' }
    });

    const ticketA = buyA.json() as { ticketId: string; code: string };
    const ticketB = buyB.json() as { ticketId: string; code: string };

    await sleep(200);

    // Organizador A tenta fazer check-in do código de B no evento A
    const crossEvent = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventA}/checkin`,
      cookies: { catraca_session: orgACookie },
      payload: { code: ticketB.code }
    });
    expect(crossEvent.statusCode).toBe(200);
    expect(crossEvent.json()).toEqual({
      ok: false,
      reason: 'invalid_ticket',
      message: 'Ingresso inválido para este evento'
    });

    // Ingresso de B permanece sem check-in
    const ticketBStatus = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${ticketB.ticketId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(ticketBStatus.json().checkedIn).toBe(false);

    // Organizador B tenta fazer check-in no evento de A -> 404 event_not_found
    const orgBOnEventA = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventA}/checkin`,
      cookies: { catraca_session: orgBCookie },
      payload: { code: ticketA.code }
    });
    expect(orgBOnEventA.statusCode).toBe(404);
    expect(orgBOnEventA.json().error).toBe('event_not_found');

    // Participante tenta fazer check-in -> 403 forbidden
    const partAttempt = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventA}/checkin`,
      cookies: { catraca_session: partCookie },
      payload: { code: ticketA.code }
    });
    expect(partAttempt.statusCode).toBe(403);
    expect(partAttempt.json().error).toBe('forbidden');

    // Visitante (sem sessão) tenta fazer check-in -> 401 unauthorized
    const visitorAttempt = await app.inject({
      method: 'POST',
      url: `/api/organizer/events/${eventA}/checkin`,
      payload: { code: ticketA.code }
    });
    expect(visitorAttempt.statusCode).toBe(401);
    expect(visitorAttempt.json().error).toBe('unauthorized');

    // Ingresso de A continua intacto (checkedIn: false)
    const ticketAStatus = await app.inject({
      method: 'GET',
      url: `/api/partner/tickets/${ticketA.ticketId}`,
      headers: { 'x-api-key': API_KEY }
    });
    expect(ticketAStatus.json().checkedIn).toBe(false);
  });

  it('R10 concorrência: duas submissões simultâneas do mesmo código liberam entrada exatamente uma vez', async () => {
    const orgACookie = await loginAs(app, 'org.a@catraca.local', 'OrgA1234!');
    const eventId = await createPublishedEvent(app, orgACookie);

    const buy = await app.inject({
      method: 'POST',
      url: `/api/partner/events/${eventId}/purchases`,
      headers: { 'x-api-key': API_KEY },
      payload: { buyerEmail: 'race@example.com', cardNumber: '4000000000000001' }
    });
    const code = buy.json().code as string;

    await sleep(200);

    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/organizer/events/${eventId}/checkin`,
        cookies: { catraca_session: orgACookie },
        payload: { code }
      }),
      app.inject({
        method: 'POST',
        url: `/api/organizer/events/${eventId}/checkin`,
        cookies: { catraca_session: orgACookie },
        payload: { code }
      })
    ]);

    const reasons = [r1.json().reason, r2.json().reason].sort();
    expect(reasons).toEqual(['already_checked_in', 'checked_in']);
  });
});
