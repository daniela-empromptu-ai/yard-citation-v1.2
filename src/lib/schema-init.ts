import { dbSchema, dbQuery } from './db'
import { SCHEMA_DEF } from './schema-def'

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

  // Ensure default users exist
  const { IDS } = await import('./seed-ids')
  const users = [
    { id: IDS.USER_JACK, name: 'Jack Scrivener', email: 'jack@yard.internal', role: 'qualifier' },
    { id: IDS.USER_ARYA, name: 'Arya', email: 'arya@yard.internal', role: 'outreach' },
    { id: IDS.USER_KARL, name: 'Karl McCarthy', email: 'karl@yard.internal', role: 'admin' },
  ]
  for (const u of users) {
    await dbQuery(
      `INSERT INTO app_users (id, name, email, role, created_at, updated_at) VALUES ($1,$2,$3,$4,now(),now()) ON CONFLICT (email) DO NOTHING`,
      [u.id, u.name, u.email, u.role]
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
