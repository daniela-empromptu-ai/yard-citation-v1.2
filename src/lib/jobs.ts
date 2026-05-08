import { dbQuery, t } from '@/lib/db'

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
