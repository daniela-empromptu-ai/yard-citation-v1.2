import { dbQuery } from './db'

// Domain tables in dependency order (children first)
const DOMAIN_TABLES = [
  'demo_seed_runs',
  'job_events',
  'jobs',
  'pii_access_events',
  'campaign_attachments',
  'outreach_packet_evidence',
  'outreach_activity',
  'outreach_packets',
  'human_reviews',
  'angle_evidence',
  'content_angles',
  'evaluation_recommended_content',
  'evidence_snippets',
  'creator_evaluations',
  'content_items',
  'campaign_creators',
  'creator_notes',
  'creator_pricing',
  'creator_status_flags',
  'creator_contacts',
  'creator_platform_accounts',
  'creators',
  'gumshoe_imports',
  'prompt_citations',
  'campaign_prompt_gaps',
  'campaign_search_terms',
  'campaign_topics',
  'campaign_personas',
  'campaigns',
  'clients',
  'app_users',
  'activity_log',
]

const SETTINGS_TABLES = ['app_settings', 'integration_status']

export async function clearDemoData(): Promise<{ cleared: string[]; errors: string[] }> {
  const cleared: string[] = []
  const errors: string[] = []

  for (const table of DOMAIN_TABLES) {
    try {
      await dbQuery(`DELETE FROM ${table}`, [])
      cleared.push(table)
    } catch (e) {
      errors.push(`${table}: ${(e as Error).message}`)
    }
  }

  for (const table of SETTINGS_TABLES) {
    try {
      await dbQuery(`DELETE FROM ${table}`, [])
      cleared.push(table)
    } catch (e) {
      errors.push(`${table}: ${(e as Error).message}`)
    }
  }

  return { cleared, errors }
}
