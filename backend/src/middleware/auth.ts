import { FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import { config } from '../config.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'participant' | 'organizer';
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

export function makeAuthHelpers(pool: Pool, partnerApiKey = config.partnerApiKey) {
  async function attachSession(request: FastifyRequest): Promise<void> {
    request.authUser = null;
    const token = request.cookies?.[config.sessionCookieName];
    if (!token) {
      return;
    }

    const res = await pool.query<{
      id: string;
      name: string;
      email: string;
      role: 'participant' | 'organizer';
    }>(
      `
      SELECT u.id, u.name, u.email, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW()
      `,
      [token]
    );

    if (res.rows[0]) {
      request.authUser = res.rows[0];
    }
  }

  async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.authUser) {
      reply.code(401).send({ error: 'unauthorized' });
    }
  }

  async function requireOrganizer(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.authUser) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    if (request.authUser.role !== 'organizer') {
      reply.code(403).send({ error: 'forbidden' });
    }
  }

  async function requireParticipant(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.authUser) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    if (request.authUser.role !== 'participant') {
      reply.code(403).send({ error: 'forbidden' });
    }
  }

  async function requirePartnerApiKey(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const rawHeader = request.headers['x-api-key'];
    const apiKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!apiKey || apiKey !== partnerApiKey) {
      reply.code(401).send({ error: 'unauthorized' });
    }
  }

  return {
    attachSession,
    requireAuth,
    requireOrganizer,
    requireParticipant,
    requirePartnerApiKey
  };
}
