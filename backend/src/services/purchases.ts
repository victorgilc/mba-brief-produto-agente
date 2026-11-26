import crypto from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { withTransaction } from '../db/pool.js';
import { DomainError, EventRow } from './events.js';
import { SimulatedGateway } from './gateway.js';

export type TicketStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'refunded';

export const CARD_NUMBER_REGEX = /^\d{16}$/;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateTicketCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export const partnerPurchaseSchema = z.object({
  buyerEmail: z.string().trim().email('E-mail inválido'),
  cardNumber: z
    .string()
    .regex(CARD_NUMBER_REGEX, 'O número do cartão deve ter exatamente 16 dígitos')
});

export const webPurchaseSchema = z.object({
  cardNumber: z
    .string()
    .regex(CARD_NUMBER_REGEX, 'O número do cartão deve ter exatamente 16 dígitos')
});

export interface PurchaseResult {
  ticketId: string;
  code: string;
  status: 'pending';
}

export interface PartnerTicketDTO {
  ticketId: string;
  code: string;
  eventId: string;
  status: TicketStatus;
  checkedIn: boolean;
}

export interface UserTicketDTO {
  ticketId: string;
  code: string;
  eventId: string;
  eventName: string;
  eventStartsAt: string;
  eventLocation: string;
  status: TicketStatus;
  checkedIn: boolean;
  priceCents: number;
  createdAt: string;
}

export async function purchaseTicket(
  pool: Pool,
  gateway: SimulatedGateway,
  params: {
    eventId: string;
    buyerEmail: string;
    cardNumber: string;
    userId: string | null;
    channel: 'web' | 'partner';
  }
): Promise<PurchaseResult> {
  const { eventId, buyerEmail, cardNumber, userId, channel } = params;

  if (!CARD_NUMBER_REGEX.test(cardNumber)) {
    throw new DomainError(
      422,
      'invalid_request',
      'O número do cartão deve ter exatamente 16 dígitos'
    );
  }

  const created = await withTransaction(pool, async (client) => {
    // R07: Pessimistic row-level lock on the event row prevents concurrent overbooking
    const eventRes = await client.query<EventRow>(
      `
      SELECT id, organizer_id, name, starts_at, location, capacity, price_cents, status
      FROM events
      WHERE id = $1
      FOR UPDATE
      `,
      [eventId]
    );

    const event = eventRes.rows[0];
    if (!event || event.status !== 'published') {
      throw new DomainError(
        404,
        'event_not_available',
        'Evento não disponível para compra'
      );
    }

    const occRes = await client.query<{ occupied: number }>(
      `
      SELECT COUNT(*)::int AS occupied
      FROM tickets
      WHERE event_id = $1 AND status IN ('pending', 'confirmed')
      `,
      [eventId]
    );
    const occupied = occRes.rows[0]?.occupied ?? 0;

    if (occupied >= event.capacity) {
      throw new DomainError(409, 'sold_out', 'Ingressos esgotados');
    }

    const ticketId = `tkt_${crypto.randomBytes(5).toString('hex')}`;
    const cardLast4 = cardNumber.slice(-4);

    // Retry code generation in the rare case of a unique collision
    let code = generateTicketCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await client.query(
          `
          INSERT INTO tickets (
            id, code, event_id, user_id, buyer_email, channel,
            price_cents, status, checked_in, card_last4
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', FALSE, $8)
          `,
          [
            ticketId,
            code,
            eventId,
            userId,
            buyerEmail.toLowerCase(),
            channel,
            event.price_cents,
            cardLast4
          ]
        );
        break;
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === '23505' && attempt < 4) {
          code = generateTicketCode();
          continue;
        }
        throw err;
      }
    }

    return {
      ticketId,
      code,
      status: 'pending' as const
    };
  });

  // R06: Schedule asynchronous gateway decision after COMMIT without blocking the response
  gateway.schedulePayment(pool, {
    ticketId: created.ticketId,
    eventId,
    cardNumber
  });

  return created;
}

export async function getPartnerTicket(
  pool: Pool,
  ticketId: string
): Promise<PartnerTicketDTO> {
  const res = await pool.query<{
    id: string;
    code: string;
    event_id: string;
    status: TicketStatus;
    checked_in: boolean;
  }>(
    `
    SELECT id, code, event_id, status, checked_in
    FROM tickets
    WHERE id = $1
    `,
    [ticketId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new DomainError(404, 'ticket_not_found', 'Ingresso não encontrado');
  }

  return {
    ticketId: row.id,
    code: row.code,
    eventId: row.event_id,
    status: row.status,
    checkedIn: row.checked_in
  };
}

export async function listUserTickets(
  pool: Pool,
  userId: string
): Promise<UserTicketDTO[]> {
  const res = await pool.query<{
    id: string;
    code: string;
    event_id: string;
    event_name: string;
    event_starts_at: Date;
    event_location: string;
    status: TicketStatus;
    checked_in: boolean;
    price_cents: number;
    created_at: Date;
  }>(
    `
    SELECT
      t.id,
      t.code,
      t.event_id,
      e.name AS event_name,
      e.starts_at AS event_starts_at,
      e.location AS event_location,
      t.status,
      t.checked_in,
      t.price_cents,
      t.created_at
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    WHERE t.user_id = $1
    ORDER BY t.created_at DESC
    `,
    [userId]
  );

  return res.rows.map((r) => ({
    ticketId: r.id,
    code: r.code,
    eventId: r.event_id,
    eventName: r.event_name,
    eventStartsAt: new Date(r.event_starts_at).toISOString(),
    eventLocation: r.event_location,
    status: r.status,
    checkedIn: r.checked_in,
    priceCents: r.price_cents,
    createdAt: new Date(r.created_at).toISOString()
  }));
}
