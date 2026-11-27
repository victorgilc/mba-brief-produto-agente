import { Pool } from 'pg';
import { z } from 'zod';
import { withTransaction } from '../db/pool.js';
import { DomainError, EventStatus } from './events.js';
import { TicketStatus } from './purchases.js';

export type CheckinReason =
  | 'invalid_ticket'
  | 'event_cancelled'
  | 'ticket_not_confirmed'
  | 'already_checked_in'
  | 'checked_in';

export interface CheckinResult {
  ok: boolean;
  reason: CheckinReason;
  message: string;
}

export const checkinInputSchema = z.object({
  code: z
    .string({ required_error: 'Código do ingresso é obrigatório' })
    .trim()
    .min(1, 'Código do ingresso é obrigatório')
    .transform((value) => value.toUpperCase())
});

export async function performCheckin(
  pool: Pool,
  organizerId: string,
  eventId: string,
  rawCode: string
): Promise<CheckinResult> {
  const normalizedCode = rawCode.trim().toUpperCase();

  return withTransaction(pool, async (client) => {
    const eventRes = await client.query<{
      id: string;
      organizer_id: string;
      status: EventStatus;
    }>(
      `
      SELECT id, organizer_id, status
      FROM events
      WHERE id = $1
      FOR UPDATE
      `,
      [eventId]
    );

    const event = eventRes.rows[0];
    if (!event || event.organizer_id !== organizerId) {
      throw new DomainError(404, 'event_not_found', 'Evento não encontrado');
    }

    const ticketRes = await client.query<{
      id: string;
      event_id: string;
      status: TicketStatus;
      checked_in: boolean;
    }>(
      `
      SELECT id, event_id, status, checked_in
      FROM tickets
      WHERE UPPER(code) = $1
      FOR UPDATE
      `,
      [normalizedCode]
    );

    const ticket = ticketRes.rows[0];

    // R10 precedence order:
    // 1. Código inexistente ou de outro evento
    if (!ticket || ticket.event_id !== event.id) {
      return {
        ok: false,
        reason: 'invalid_ticket',
        message: 'Ingresso inválido para este evento'
      };
    }

    // 2. Evento cancelado
    if (event.status === 'cancelled') {
      return {
        ok: false,
        reason: 'event_cancelled',
        message: 'Evento cancelado'
      };
    }

    // 3. Ingresso não confirmado
    if (ticket.status !== 'confirmed') {
      return {
        ok: false,
        reason: 'ticket_not_confirmed',
        message: 'Ingresso não confirmado'
      };
    }

    // 4. Ingresso já passou pelo check-in
    if (ticket.checked_in) {
      return {
        ok: false,
        reason: 'already_checked_in',
        message: 'Ingresso já utilizado'
      };
    }

    // 5. Nenhuma das anteriores -> Entrada liberada
    await client.query(
      `
      UPDATE tickets
      SET checked_in = TRUE, checked_in_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [ticket.id]
    );

    return {
      ok: true,
      reason: 'checked_in',
      message: 'Entrada liberada'
    };
  });
}
