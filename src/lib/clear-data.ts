import { dbQuery } from './db'
import { IDS } from './seed-ids'

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
