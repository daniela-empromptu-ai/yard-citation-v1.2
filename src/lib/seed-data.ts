import { dbQuery } from './db'
import { IDS } from './seed-ids'

const NOW = '2026-02-20 12:00:00Z'

export async function seedDemoData(): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0
  const errors: string[] = []

  async function run(query: string, params: unknown[], label: string) {
    try {
      await dbQuery(query, params)
      inserted++
    } catch (e) {
      const msg = `${label}: ${(e as Error).message}`
      errors.push(msg)
      console.error(msg)
    }
  }

  // ---- USERS ----
  await run(
    `INSERT INTO app_users (id, name, email, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
    [IDS.USER_JACK, 'Jack Scrivener', 'jack@yard.live', 'qualifier', NOW, NOW],
    'user_jack'
  )
  await run(
    `INSERT INTO app_users (id, name, email, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
    [IDS.USER_KARL, 'Karl McCarthy', 'karl@yard.live', 'admin', NOW, NOW],
    'user_karl'
  )

  // ---- APP SETTINGS ----
  await run(
    `INSERT INTO app_settings (id, mask_pii_by_default, outreach_ready_score_threshold, min_evidence_coverage, default_ai_model, created_at, updated_at)
     VALUES ($1, true, 75, 'medium', 'claude', $2, $3) ON CONFLICT DO NOTHING`,
    [IDS.SETTINGS_ID, NOW, NOW],
    'app_settings'
  )

  // ---- INTEGRATION STATUS ----
  for (const key of ['gumshoe', 'youtube']) {
    await run(
      `INSERT INTO integration_status (id, integration_key, is_configured, updated_at)
       VALUES (gen_random_uuid(), $1, false, $2) ON CONFLICT (integration_key) DO NOTHING`,
      [key, NOW],
      `integration_${key}`
    )
  }

  // ---- DEMO SEED RUNS ----
  await run(
    `INSERT INTO demo_seed_runs (id, seed_version, seeded_at, seeded_by_user_id, notes)
     VALUES (gen_random_uuid(),'v0-demo-1',$1,$2,'Initial v0 demo dataset') ON CONFLICT DO NOTHING`,
    [NOW, IDS.USER_JACK], 'seed_run'
  )

  return { inserted, errors }
}
