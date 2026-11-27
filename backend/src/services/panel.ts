import { Pool } from 'pg';
import { computeAvailableSeats, DomainError, EventStatus } from './events.js';

export interface EventPanelDTO {
  eventId: string;
  confirmed: number;
  pending: number;
  checkedIn: number;
  availableSeats: number;
  revenueCents: number;
  refunded: number;
}

export async function getEventPanel(
  pool: Pool,
  organizerId: string,
  eventId: string
): Promise<EventPanelDTO> {
  const evRes = await pool.query<{
    id: string;
    organizer_id: string;
    capacity: number;
    status: EventStatus;
  }>(
    `SELECT id, organizer_id, capacity, status FROM events WHERE id = $1`,
    [eventId]
  );

  const ev = evRes.rows[0];
  if (!ev || ev.organizer_id !== organizerId) {
    throw new DomainError(404, 'event_not_found', 'Evento não encontrado');
  }

  const aggRes = await pool.query<{
    confirmed: number;
    pending: number;
    checked_in: number;
    revenue_cents: number;
    refunded: number;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed' AND checked_in = TRUE)::int AS checked_in,
      COALESCE(SUM(price_cents) FILTER (WHERE status = 'confirmed'), 0)::int AS revenue_cents,
      COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded
    FROM tickets
    WHERE event_id = $1
    `,
    [eventId]
  );

  const row = aggRes.rows[0] ?? {
    confirmed: 0,
    pending: 0,
    checked_in: 0,
    revenue_cents: 0,
    refunded: 0
  };

  const occupiedSeats = row.confirmed + row.pending;
  const availableSeats = computeAvailableSeats(
    ev.status,
    ev.capacity,
    occupiedSeats
  );

  return {
    eventId: ev.id,
    confirmed: row.confirmed,
    pending: row.pending,
    checkedIn: row.checked_in,
    availableSeats,
    revenueCents: row.revenue_cents,
    refunded: row.refunded
  };
}
