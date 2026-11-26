import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { runSeed } from '../src/db/seed.js';
import { ensureTestDatabase, resetTestDatabase } from './test-db.js';

describe('F01 - Fundação, Autenticação, RBAC e X-Api-Key', () => {
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

  it('GET /health retorna 200 ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('seed cria 2 organizadores e 1 participante e é idempotente ao rodar novamente', async () => {
    await runSeed(pool);
    await runSeed(pool);

    const accounts = [
      { email: 'org.a@catraca.local', password: 'OrgA1234!', role: 'organizer' },
      { email: 'org.b@catraca.local', password: 'OrgB1234!', role: 'organizer' },
      { email: 'participante@catraca.local', password: 'Part1234!', role: 'participant' }
    ];

    for (const acc of accounts) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: acc.email, password: acc.password }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.role).toBe(acc.role);
    }
  });

  it('participante cria conta, autentica e faz logout; nunca eleva para organizer', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Maria',
        email: 'maria@example.com',
        password: 'password123',
        role: 'organizer'
      }
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().user.role).toBe('participant');
    const cookie = reg.cookies.find((c) => c.name === 'catraca_session');
    expect(cookie).toBeDefined();

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { catraca_session: cookie!.value }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('maria@example.com');

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { catraca_session: cookie!.value }
    });
    expect(logout.statusCode).toBe(204);

    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { catraca_session: cookie!.value }
    });
    expect(meAfter.json().user).toBeNull();
  });

  it('R13: visitante recebe 401, participante recebe 403 e organizador acessa área de organizador', async () => {
    const visitor = await app.inject({ method: 'GET', url: '/api/organizer/me' });
    expect(visitor.statusCode).toBe(401);

    const partLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'participante@catraca.local', password: 'Part1234!' }
    });
    const partCookie = partLogin.cookies.find((c) => c.name === 'catraca_session')!.value;

    const partOrg = await app.inject({
      method: 'GET',
      url: '/api/organizer/me',
      cookies: { catraca_session: partCookie }
    });
    expect(partOrg.statusCode).toBe(403);

    const orgLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'org.a@catraca.local', password: 'OrgA1234!' }
    });
    const orgCookie = orgLogin.cookies.find((c) => c.name === 'catraca_session')!.value;

    const orgRes = await app.inject({
      method: 'GET',
      url: '/api/organizer/me',
      cookies: { catraca_session: orgCookie }
    });
    expect(orgRes.statusCode).toBe(200);
    expect(orgRes.json().user.email).toBe('org.a@catraca.local');
  });

  it('API de parceiros rejeita ausência ou chave inválida com 401 unauthorized', async () => {
    const noKey = await app.inject({ method: 'GET', url: '/api/partner/ping' });
    expect(noKey.statusCode).toBe(401);
    expect(noKey.json()).toEqual({ error: 'unauthorized' });

    const wrongKey = await app.inject({
      method: 'GET',
      url: '/api/partner/ping',
      headers: { 'x-api-key': 'chave-invalida' }
    });
    expect(wrongKey.statusCode).toBe(401);
    expect(wrongKey.json()).toEqual({ error: 'unauthorized' });

    const validKey = await app.inject({
      method: 'GET',
      url: '/api/partner/ping',
      headers: { 'x-api-key': 'catraca-partner-key-2026' }
    });
    expect(validKey.statusCode).toBe(200);
  });
});
