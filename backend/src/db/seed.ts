import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

export const SEED_USERS = [
  {
    id: 'usr_org_a',
    name: 'Organizador A',
    email: 'org.a@catraca.local',
    password: 'OrgA1234!',
    role: 'organizer' as const
  },
  {
    id: 'usr_org_b',
    name: 'Organizador B',
    email: 'org.b@catraca.local',
    password: 'OrgB1234!',
    role: 'organizer' as const
  },
  {
    id: 'usr_part_seed',
    name: 'Participante Seed',
    email: 'participante@catraca.local',
    password: 'Part1234!',
    role: 'participant' as const
  }
];

export async function runSeed(pool: Pool): Promise<void> {
  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role
      `,
      [user.id, user.name, user.email.toLowerCase(), passwordHash, user.role]
    );
  }
}
