import crypto from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { withTransaction } from '../db/pool.js';

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface EventRow {
  id: string;
  organizer_id: string;
  name: string;
  starts_at: Date;
  location: string;
  capacity: number;
  price_cents: number;
  status: EventStatus;
  created_at: Date;
  updated_at: Date;
}

export interface EventDTO {
  id: string;
  organizerId: string;
  name: string;
  startsAt: string;
  location: string;
  capacity: number;
  priceCents: number;
  status: EventStatus;
  occupiedSeats: number;
  availableSeats: number;
}

export class DomainError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message?: string) {
    super(message ?? code);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const eventInputSchema = z.object({
  name: z.string().trim().min(1, 'Nome do evento é obrigatório').max(200),
  startsAt: z.string().min(1, 'Data de início é obrigatória'),
  location: z.string().trim().min(1, 'Local é obrigatório').max(250),
  capacity: z
    .number()
    .int('Lotação deve ser um número inteiro')
    .min(1, 'Lotação mínima é 1'),
  priceCents: z
    .number()
    .int('Preço inválido')
    .min(1, 'Preço deve ser maior que zero')
});

export type EventInput = z.infer<typeof eventInputSchema>;

function parseAndValidateFutureDate(startsAt: string): Date {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError(422, 'invalid_request', 'Data de início inválida');
  }
  if (date.getTime() <= Date.now()) {
    throw new DomainError(
      422,
      'invalid_starts_at',
      'A data de início deve estar no futuro'
    );
  }
  return date;
}

export function computeAvailableSeats(
  status: EventStatus,
  capacity: number,
  occupiedSeats: number
): number {
  if (status === 'cancelled') {
    return 0;
  }
  return Math.max(0, capacity - occupiedSeats);
}

export async function getOccupiedSeats(
  queryable: Pool | PoolClient,
  eventId: string
): Promise<number> {
  const tbl = await queryable.query<{ exists: string | null }>(
    `SELECT to_regclass('public.tickets')::text AS exists`
  );
  if (!tbl.rows[0]?.exists) {
    return 0;
  }

  const res = await queryable.query<{ occupied: number }>(
    `
    SELECT COUNT(*)::int AS occupied
    FROM tickets
    WHERE event_id = $1 AND status IN ('pending', 'confirmed')
    `,
    [eventId]
  );
  return res.rows[0]?.occupied ?? 0;
}

function toEventDTO(row: EventRow, occupiedSeats: number): EventDTO {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    name: row.name,
    startsAt: new Date(row.starts_at).toISOString(),
    location: row.location,
    capacity: row.capacity,
    priceCents: row.price_cents,
    status: row.status,
    occupiedSeats,
    availableSeats: computeAvailableSeats(row.status, row.capacity, occupiedSeats)
  };
}

export async function createEvent(
  pool: Pool,
  organizerId: string,
  rawInput: unknown
): Promise<EventDTO> {
  const parsed = eventInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new DomainError(
      422,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Dados inválidos'
    );
  }

  const { name, startsAt, location, capacity, priceCents } = parsed.data;
  const startsAtDate = parseAndValidateFutureDate(startsAt);
  const id = `evt_${crypto.randomBytes(4).toString('hex')}`;

  const res = await pool.query<EventRow>(
    `
    INSERT INTO events (id, organizer_id, name, starts_at, location, capacity, price_cents, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
    RETURNING *
    `,
    [id, organizerId, name, startsAtDate, location, capacity, priceCents]
  );

  return toEventDTO(res.rows[0], 0);
}

export async function listOrganizerEvents(
  pool: Pool,
  organizerId: string
): Promise<EventDTO[]> {
  const res = await pool.query<EventRow>(
    `
    SELECT *
    FROM events
    WHERE organizer_id = $1
    ORDER BY created_at DESC
    `,
    [organizerId]
  );

  const items: EventDTO[] = [];
  for (const row of res.rows) {
    const occupied = await getOccupiedSeats(pool, row.id);
    items.push(toEventDTO(row, occupied));
  }
  return items;
}

export async function getOrganizerEvent(
  pool: Pool,
  organizerId: string,
  eventId: string
): Promise<EventDTO> {
  const res = await pool.query<EventRow>(
    `SELECT * FROM events WHERE id = $1 AND organizer_id = $2`,
    [eventId, organizerId]
  );
  const row = res.rows[0];
  if (!row) {
    throw new DomainError(404, 'event_not_found', 'Evento não encontrado');
  }
  const occupied = await getOccupiedSeats(pool, row.id);
  return toEventDTO(row, occupied);
}

export async function updateEvent(
  pool: Pool,
  organizerId: string,
  eventId: string,
  rawInput: unknown
): Promise<EventDTO> {
  const parsed = eventInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new DomainError(
      422,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Dados inválidos'
    );
  }

  const { name, startsAt, location, capacity, priceCents } = parsed.data;
  const startsAtDate = parseAndValidateFutureDate(startsAt);

  return withTransaction(pool, async (client) => {
    const res = await client.query<EventRow>(
      `SELECT * FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const existing = res.rows[0];
    if (!existing || existing.organizer_id !== organizerId) {
      throw new DomainError(404, 'event_not_found', 'Evento não encontrado');
    }
    if (existing.status === 'cancelled') {
      throw new DomainError(
        409,
        'event_cancelled',
        'Evento cancelado não pode ser editado'
      );
    }

    const occupied = await getOccupiedSeats(client, eventId);
    if (capacity < occupied) {
      throw new DomainError(
        409,
        'capacity_below_occupied',
        `A lotação não pode ser menor que as vagas ocupadas (${occupied})`
      );
    }

    const updated = await client.query<EventRow>(
      `
      UPDATE events
      SET name = $2,
          starts_at = $3,
          location = $4,
          capacity = $5,
          price_cents = $6,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [eventId, name, startsAtDate, location, capacity, priceCents]
    );

    return toEventDTO(updated.rows[0], occupied);
  });
}

export async function publishEvent(
  pool: Pool,
  organizerId: string,
  eventId: string
): Promise<EventDTO> {
  return withTransaction(pool, async (client) => {
    const res = await client.query<EventRow>(
      `SELECT * FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const existing = res.rows[0];
    if (!existing || existing.organizer_id !== organizerId) {
      throw new DomainError(404, 'event_not_found', 'Evento não encontrado');
    }
    if (existing.status === 'cancelled') {
      throw new DomainError(
        409,
        'event_cancelled',
        'Evento cancelado não pode ser republicado'
      );
    }

    const updated = await client.query<EventRow>(
      `
      UPDATE events
      SET status = 'published', updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [eventId]
    );

    const occupied = await getOccupiedSeats(client, eventId);
    return toEventDTO(updated.rows[0], occupied);
  });
}

export async function listPublicEvents(pool: Pool): Promise<EventDTO[]> {
  const res = await pool.query<EventRow>(
    `
    SELECT *
    FROM events
    WHERE status = 'published'
    ORDER BY starts_at ASC
    `
  );

  const items: EventDTO[] = [];
  for (const row of res.rows) {
    const occupied = await getOccupiedSeats(pool, row.id);
    items.push(toEventDTO(row, occupied));
  }
  return items;
}
