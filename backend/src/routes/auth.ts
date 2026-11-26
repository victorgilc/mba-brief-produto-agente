import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';
import { config } from '../config.js';
import { makeAuthHelpers } from '../middleware/auth.js';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  email: z.string().trim().email('E-mail inválido').max(200),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').max(120)
});

const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

async function createSession(pool: Pool, userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000
  );
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  return token;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  pool: Pool,
  auth: ReturnType<typeof makeAuthHelpers>
): Promise<void> {
  app.get('/health', async (_request, reply) => {
    await pool.query('SELECT 1');
    return reply.code(200).send({ status: 'ok' });
  });

  app.get('/api/auth/me', async (request, reply) => {
    return reply.code(200).send({ user: request.authUser });
  });

  app.post('/api/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({
        error: 'invalid_request',
        message: parsed.error.issues[0]?.message ?? 'Dados inválidos'
      });
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );
    if (existing.rows.length > 0) {
      return reply.code(409).send({
        error: 'email_already_in_use',
        message: 'Este e-mail já está cadastrado'
      });
    }

    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const passwordHash = await bcrypt.hash(password, 10);

    // Public registration is strictly participant-only (never organizer)
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'participant')`,
      [id, name, normalizedEmail, passwordHash]
    );

    const token = await createSession(pool, id);
    reply.setCookie(config.sessionCookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: config.sessionTtlDays * 24 * 60 * 60
    });

    return reply.code(201).send({
      user: { id, name, email: normalizedEmail, role: 'participant' }
    });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({
        error: 'invalid_request',
        message: parsed.error.issues[0]?.message ?? 'Dados inválidos'
      });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const res = await pool.query<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
      role: 'participant' | 'organizer';
    }>(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [normalizedEmail]
    );

    const user = res.rows[0];
    if (!user) {
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'E-mail ou senha inválidos' });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!valid) {
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'E-mail ou senha inválidos' });
    }

    const token = await createSession(pool, user.id);
    reply.setCookie(config.sessionCookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: config.sessionTtlDays * 24 * 60 * 60
    });

    return reply.code(200).send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies?.[config.sessionCookieName];
    if (token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    }
    reply.clearCookie(config.sessionCookieName, { path: '/' });
    return reply.code(204).send();
  });

  app.get(
    '/api/organizer/me',
    { preHandler: auth.requireOrganizer },
    async (request, reply) => {
      return reply.code(200).send({ user: request.authUser });
    }
  );

  app.get(
    '/api/partner/ping',
    { preHandler: auth.requirePartnerApiKey },
    async (_request, reply) => {
      return reply.code(200).send({ ok: true });
    }
  );
}
