import { Pool } from 'pg';
import { withTransaction } from '../db/pool.js';
import { DomainError, EventDTO, EventRow } from './events.js';

export interface CancelEventResult {
  event: EventDTO;
  refundedCount: number;
  cancelledCount: number;
}

export async function cancelEvent(
  pool: Pool,
  organizerId: string,
  eventId: string
): Promise<CancelEventResult> {
  return withTransaction(pool, async (client) => {
    // R11: Lock the event row to serialize with concurrent purchases and late gateway callbacks
    const existingRes = await client.query<EventRow>(
      `SELECT * FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const existing = existingRes.rows[0];
    if (!existing || existing.organizer_id !== organizerId) {
      throw new DomainError(404, 'event_not_found', 'Evento não encontrado');
    }

    if (existing.status !== 'published') {
      throw new DomainError(
        409,
        'event_cannot_be_cancelled',
        'Apenas eventos publicados podem ser cancelados'
      );
    }

    const updatedRes = await client.query<EventRow>(
      `
      UPDATE events
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [eventId]
    );

    const refundedRes = await client.query(
      `
      UPDATE tickets
      SET status = 'refunded', updated_at = NOW()
      WHERE event_id = $1 AND status = 'confirmed'
      `,
      [eventId]
    );

    const cancelledRes = await client.query(
      `
      UPDATE tickets
      SET status = 'cancelled', updated_at = NOW()
      WHERE event_id = $1 AND status = 'pending'
      `,
      [eventId]
    );

    const row = updatedRes.rows[0];
    return {
      event: {
        id: row.id,
        organizerId: row.organizer_id,
        name: row.name,
        startsAt: new Date(row.starts_at).toISOString(),
        location: row.location,
        capacity: row.capacity,
        priceCents: row.price_cents,
        status: row.status,
        occupiedSeats: 0,
        availableSeats: 0
      },
      refundedCount: refundedRes.rowCount ?? 0,
      cancelledCount: cancelledRes.rowCount ?? 0
    };
  });
}
