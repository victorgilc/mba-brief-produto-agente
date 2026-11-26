import { Pool } from 'pg';
import { withTransaction } from '../db/pool.js';

export type GatewayDelayMode = 'default' | 'fast';
export type GatewayOutcome = 'confirmed' | 'declined';

export interface GatewayDecision {
  outcome: GatewayOutcome;
  delayMs: number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function determineGatewayDecision(
  cardNumber: string,
  mode: GatewayDelayMode = 'default'
): GatewayDecision {
  const last4 = cardNumber.slice(-4);
  const fastDelay = mode === 'fast' ? 60 : randomInt(2000, 3500);
  const slowDelay = mode === 'fast' ? 450 : randomInt(31000, 37000);

  switch (last4) {
    case '0001':
      return { outcome: 'confirmed', delayMs: fastDelay };
    case '0002':
      return { outcome: 'declined', delayMs: fastDelay };
    case '0003':
      return { outcome: 'confirmed', delayMs: slowDelay };
    case '0004':
      return { outcome: 'declined', delayMs: slowDelay };
    default:
      return { outcome: 'declined', delayMs: fastDelay };
  }
}

export class SimulatedGateway {
  private readonly mode: GatewayDelayMode;
  private readonly timers = new Set<NodeJS.Timeout>();
  private closed = false;

  constructor(mode: GatewayDelayMode = 'default') {
    this.mode = mode;
  }

  schedulePayment(
    pool: Pool,
    params: { ticketId: string; eventId: string; cardNumber: string }
  ): GatewayDecision {
    const decision = determineGatewayDecision(params.cardNumber, this.mode);

    const timer = setTimeout(async () => {
      this.timers.delete(timer);
      if (this.closed) {
        return;
      }

      try {
        await withTransaction(pool, async (client) => {
          // Lock the event row to serialize with concurrent cancellation (R11)
          const evRes = await client.query<{ status: string }>(
            `SELECT status FROM events WHERE id = $1 FOR UPDATE`,
            [params.eventId]
          );
          const ev = evRes.rows[0];
          if (!ev || ev.status !== 'published') {
            return;
          }

          // Only transition tickets that are still pending; never overwrite cancelled/refunded (R11)
          await client.query(
            `
            UPDATE tickets
            SET status = $2, updated_at = NOW()
            WHERE id = $1 AND status = 'pending'
            `,
            [params.ticketId, decision.outcome]
          );
        });
      } catch {
        // Ignore errors during graceful shutdown or test teardown
      }
    }, decision.delayMs);

    this.timers.add(timer);
    return decision;
  }

  clearAllTimers(): void {
    this.closed = true;
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
