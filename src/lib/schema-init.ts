import { dbSchema, dbQuery } from './db'
import { SCHEMA_DEF } from './schema-def'
import { hashSync } from 'bcryptjs'

export async function initSchema(): Promise<void> {
  // Migrate V1 creators: add name column and copy display_name before schema enforces NOT NULL
  try {
    await dbQuery(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS name text`, [])
    await dbQuery(`UPDATE creators SET name = display_name WHERE name IS NULL AND display_name IS NOT NULL`, [])
    // Also add platform column with default so NOT NULL constraint passes
    await dbQuery(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS platform text`, [])
    await dbQuery(`UPDATE creators SET platform = 'youtube' WHERE platform IS NULL`, [])
  } catch {
    // Table may not exist yet — safe to ignore on first run
  }

  await dbSchema(SCHEMA_DEF)

  // Add password_hash column if not exists (additive migration)
  try {
    await dbQuery(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text`, [])
  } catch {
    // ignore
  }

  // Seed users with hashed passwords
  const { IDS } = await import('./seed-ids')
  const users = [
    { id: IDS.USER_JACK,      name: 'Jack Scrivener',  email: 'jack@yard.live',     role: 'qualifier', password: 'mefbI5-dogvov-riqpih' },
    { id: IDS.USER_KARL,      name: 'Karl McCarthy',   email: 'karl@yard.live',     role: 'admin',     password: 'mefbI5-dogvov-riqpih' },
    { id: IDS.USER_EMPROMPTU, name: 'Empromptu Admin', email: 'admin@empromptu.ai', role: 'admin',     password: 'yard-admin-2026!' },
  ]
  for (const u of users) {
    const hash = hashSync(u.password, 10)
    await dbQuery(
      `INSERT INTO app_users (id, name, email, role, password_hash, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,now(),now())
       ON CONFLICT (email) DO UPDATE SET password_hash = $5, name = $2, role = $4, updated_at = now()`,
      [u.id, u.name, u.email, u.role, hash]
    )
  }

  // Seed initial categories (controlled niche taxonomy)
  const categories = [
    'DevOps & SRE',
    'Cloud Infrastructure',
    'Software Engineering',
    'AI & Machine Learning',
    'Data Engineering',
    'Cybersecurity',
    'Developer Tools',
    'Platform Engineering',
    'Observability',
    'Kubernetes & Containers',
  ]
  for (const cat of categories) {
    const exists = await dbQuery<{ id: string }>(
      `SELECT id FROM categories WHERE name = $1 AND parent_id IS NULL LIMIT 1`,
      [cat]
    )
    if (exists.data.length === 0) {
      await dbQuery(
        `INSERT INTO categories (name, created_at) VALUES ($1, now())`,
        [cat]
      )
    }
  }
}
