import { Pool } from 'pg';

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('participant', 'organizer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity >= 1),
      price_cents INTEGER NOT NULL CHECK (price_cents > 0),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events (organizer_id);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      buyer_email TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('web', 'partner')),
      price_cents INTEGER NOT NULL CHECK (price_cents > 0),
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'refunded')),
      checked_in BOOLEAN NOT NULL DEFAULT FALSE,
      checked_in_at TIMESTAMPTZ,
      card_last4 TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_event_status ON tickets (event_id, status);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets (user_id);
  `);
}
