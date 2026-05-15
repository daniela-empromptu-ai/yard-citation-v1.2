import { v4 as uuidv4 } from 'uuid'
import { dbQuery, t } from '@/lib/db'

export async function logJobEvent(
  jobId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await dbQuery(
      `INSERT INTO ${t('job_events')} (id, job_id, level, message, meta, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [uuidv4(), jobId, level, message, meta ? JSON.stringify(meta) : null]
    )
  } catch (e) {
    console.error('[jobs] failed to log job event:', e)
  }
}

/**
 * Mark queued/running jobs as failed if their `updated_at` is older than the
 * given threshold. Pipelines only transition status from inside the running
 * Node process, so a process killed mid-run (deploy, OOM, crash) leaves rows
 * stuck `running` forever, which the launch-guard check then treats as
 * "pipeline already running" indefinitely.
 *
 * Call this immediately before the launch-guard check in any pipeline-launch
 * route so stuck jobs self-heal on the next click.
 */
export async function reapStaleJobs(
  campaignId: string,
  maxAgeMinutes = 30
): Promise<void> {
  await dbQuery(
    `UPDATE ${t('jobs')}
       SET status = 'failed',
           error_message = COALESCE(error_message, 'stale (process likely died)'),
           finished_at = now(),
           updated_at = now()
     WHERE campaign_id = $1
       AND status IN ('queued', 'running')
       AND updated_at < now() - ($2 || ' minutes')::interval`,
    [campaignId, String(maxAgeMinutes)]
  )
}
