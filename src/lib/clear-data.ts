import { dbQuery } from './db'
import { IDS } from './seed-ids'

/**
 * Clear all campaign & creator data, preserving seed data
 * (app_users, app_settings, integration_status, demo_seed_runs).
 * Deletes in FK-safe dependency order (leaf tables first).
 */
export async function clearProjectData(): Promise<{ cleared: string[]; skipped: string[]; errors: string[] }> {
  const cleared: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  // Tables to clear, in dependency order (children before parents)
  const tables = [
    // Evaluation & evidence leaf tables
    'angle_evidence',
    'outreach_packet_evidence',
    'evidence_snippets',
    'evaluation_recommended_content',
    'prompt_citations',
    'content_angles',
    // Outreach
    'outreach_activity',
    'outreach_packets',
    // Reviews & evaluations
    'human_reviews',
    'creator_evaluations',
    // Content
    'content_items',
    // Campaign join tables
    'campaign_creators',
    'campaign_search_terms',
    'campaign_topics',
    'campaign_personas',
    'campaign_attachments',
    'campaign_prompt_gaps',
    // Job tracking
    'job_events',
    'jobs',
    // Activity & audit
    'activity_log',
    'pii_access_events',
    'gumshoe_imports',
    // Creator detail tables
    'creator_contacts',
    'creator_notes',
    'creator_pricing',
    'creator_status_flags',
    'creator_platform_accounts',
    // Top-level entities
    'creators',
    'campaigns',
    'clients',
  ]

  for (const table of tables) {
    try {
      const result = await dbQuery(`DELETE FROM ${table}`)
      if (result.affected_rows > 0) {
        cleared.push(`${table} (${result.affected_rows})`)
      } else {
        skipped.push(table)
      }
    } catch (e) {
      errors.push(`${table}: ${(e as Error).message}`)
    }
  }

  return { cleared, skipped, errors }
}

/**
 * Clear only known demo seed rows by ID (users, settings, integrations).
 */
export async function clearDemoData(): Promise<{ cleared: string[]; errors: string[] }> {
  const cleared: string[] = []
  const errors: string[] = []

  const steps: { label: string; query: string; params: unknown[] }[] = [
    {
      label: 'app_users',
      query: `DELETE FROM app_users WHERE id IN ($1, $2, $3)`,
      params: [IDS.USER_JACK, IDS.USER_ARYA, IDS.USER_KARL],
    },
    {
      label: 'app_settings',
      query: `DELETE FROM app_settings WHERE id = $1`,
      params: [IDS.SETTINGS_ID],
    },
    {
      label: 'integration_status',
      query: `DELETE FROM integration_status WHERE integration_key IN ('gumshoe','youtube','anthropic','reddit')`,
      params: [],
    },
    {
      label: 'demo_seed_runs',
      query: `DELETE FROM demo_seed_runs WHERE seed_version = 'v0-demo-1'`,
      params: [],
    },
  ]

  for (const step of steps) {
    try {
      await dbQuery(step.query, step.params)
      cleared.push(step.label)
    } catch (e) {
      errors.push(`${step.label}: ${(e as Error).message}`)
    }
  }

  return { cleared, errors }
}
