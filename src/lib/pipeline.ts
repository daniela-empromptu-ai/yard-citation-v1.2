/**
 * Pipeline orchestrator: chains discover → prequalify → score.
 * Uses jobs + job_events tables for tracking.
 * V2: Uses discovery.ts instead of Google Sheets.
 */

import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { runDiscovery, runSimilarDiscovery } from '@/lib/discovery'
import { runPrequalifyPipeline } from '@/lib/prequalify'
import { scoreCreator } from '@/lib/score-creator'

// ─── Job Helpers ───

async function logJobEvent(jobId: string, level: string, message: string, meta?: Record<string, unknown>) {
  await dbQuery(
    `INSERT INTO ${t('job_events')} (id, job_id, level, message, meta, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
    [uuidv4(), jobId, level, message, meta ? JSON.stringify(meta) : null]
  )
}

async function updateJobStatus(jobId: string, status: string, errorMessage?: string) {
  const fields = [`status=$1`, `updated_at=now()`]
  const params: unknown[] = [status]
  let idx = 2
  if (status === 'running') {
    fields.push(`started_at=now()`)
  }
  if (status === 'completed' || status === 'failed') {
    fields.push(`finished_at=now()`)
  }
  if (errorMessage) {
    fields.push(`error_message=$${idx}`)
    params.push(errorMessage)
    idx++
  }
  params.push(jobId)
  await dbQuery(
    `UPDATE ${t('jobs')} SET ${fields.join(', ')} WHERE id=$${idx}`,
    params
  )
}

async function updateCampaignStage(campaignId: string, stage: string) {
  await dbQuery(
    `UPDATE ${t('campaigns')} SET stage=$1, updated_at=now() WHERE id=$2`,
    [stage, campaignId]
  )
}

// ─── Scoring Batch ───

export async function runScoringBatch(campaignId: string, userId: string, jobId?: string): Promise<number> {
  const log = (msg: string, meta?: Record<string, unknown>) =>
    jobId ? logJobEvent(jobId, 'info', msg, meta) : Promise.resolve()

  // Load ingested creators that need scoring
  const ccRes = await dbQuery<{ id: string; creator_name: string }>(
    `SELECT cc.id, c.name as creator_name
     FROM ${t('campaign_creators')} cc
     JOIN ${t('creators')} c ON c.id = cc.creator_id
     WHERE cc.campaign_id = $1 AND cc.pipeline_stage = 'ingested' AND cc.scoring_status = 'not_scored'`,
    [campaignId]
  )

  if (ccRes.data.length === 0) {
    await log('No creators to score')
    console.log(`[pipeline] Scoring: 0 creators to score`)
    return 0
  }

  await log(`Scoring ${ccRes.data.length} creators`)
  console.log(`[pipeline] Scoring ${ccRes.data.length} creators`)

  let scored = 0
  const failed: string[] = []
  const SCORE_BATCH_SIZE = 3

  for (let i = 0; i < ccRes.data.length; i += SCORE_BATCH_SIZE) {
    const batch = ccRes.data.slice(i, i + SCORE_BATCH_SIZE)
    await log(`Scoring ${batch.map(c => c.creator_name).join(', ')}...`)
    const batchResults = await Promise.allSettled(batch.map(cc => scoreCreator(cc.id)))

    for (let j = 0; j < batch.length; j++) {
      const cc = batch[j]
      const result = batchResults[j]
      if (result.status === 'rejected') {
        failed.push(cc.creator_name)
        console.error(`[pipeline] Scoring error for ${cc.creator_name}:`, result.reason)
        try { await log(`Scoring error for ${cc.creator_name}: ${result.reason}`) } catch { /* ignore */ }
      } else if (result.value.ok) {
        scored++
        console.log(`[pipeline] Scored ${cc.creator_name}: ${result.value.overall_score}/100`)
        await log(`Scored ${cc.creator_name}: ${result.value.overall_score}/100`, {
          creator: cc.creator_name,
          score: result.value.overall_score,
          coverage: result.value.evidence_coverage,
        })
      } else {
        failed.push(cc.creator_name)
        console.log(`[pipeline] Scoring failed for ${cc.creator_name}: ${result.value.error}`)
        await log(`Scoring failed for ${cc.creator_name}: ${result.value.error}`)
      }
    }
  }

  const summary = failed.length > 0
    ? `Scoring complete: ${scored}/${ccRes.data.length} scored. Failed: ${failed.join(', ')}`
    : `Scoring complete: ${scored}/${ccRes.data.length} scored`
  await log(summary)
  return scored
}

// ─── Surface More Pipeline (no reset — preserves dismissed/scored creators) ───

export async function runSurfaceMorePipeline(
  campaignId: string,
  userId: string,
  jobId: string,
  seedCreatorId?: string
): Promise<void> {
  try {
    await updateJobStatus(jobId, 'running')
    const startMsg = seedCreatorId
      ? `Find Similar started — anchoring on creator ${seedCreatorId}`
      : 'Surface More started — discovering additional creators'
    await logJobEvent(jobId, 'info', startMsg)

    // ── Step 1: Discovery (dedup skips all existing campaign_creators) ──
    const stepLabel = seedCreatorId
      ? 'Step 1/3: Discovery — finding creators similar to seed'
      : 'Step 1/3: Discovery — finding additional creators'
    await logJobEvent(jobId, 'info', stepLabel)
    const discoveryResult = seedCreatorId
      ? await runSimilarDiscovery(campaignId, userId, seedCreatorId)
      : await runDiscovery(campaignId, userId)
    await logJobEvent(jobId, 'info', `Discovery complete: ${discoveryResult.total_linked} new creators linked`, discoveryResult as unknown as Record<string, unknown>)

    if (discoveryResult.total_linked === 0) {
      await logJobEvent(jobId, 'warn', 'No new creators discovered')
      await updateJobStatus(jobId, 'completed')
      return
    }

    // ── Step 2: Pre-qualification ──
    await logJobEvent(jobId, 'info', 'Step 2/3: Pre-qualification — fetching content & narrowing')
    const campRes = await dbQuery<{ creative_brief: string }>(
      `SELECT creative_brief FROM ${t('campaigns')} WHERE id = $1`,
      [campaignId]
    )
    const topicsRes = await dbQuery<{ topic: string }>(
      `SELECT topic FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
      [campaignId]
    )

    try {
      const prequalResult = await runPrequalifyPipeline(campaignId, userId, {
        brief: campRes.data[0]?.creative_brief || '',
        topics: topicsRes.data.map(r => r.topic),
      })
      await logJobEvent(jobId, 'info', `Pre-qualification complete: ${prequalResult.selected_count} selected from ${prequalResult.total_discovered}`)
    } catch (e) {
      await logJobEvent(jobId, 'warn', `Pre-qualification failed: ${(e as Error).message} — continuing to scoring`)
    }

    // ── Step 3: Scoring ──
    await logJobEvent(jobId, 'info', 'Step 3/3: Scoring — evaluating new creators')
    const scored = await runScoringBatch(campaignId, userId, jobId)
    await logJobEvent(jobId, 'info', `Scoring complete: ${scored} creators scored`)

    await updateJobStatus(jobId, 'completed')
    await logJobEvent(jobId, 'info', 'Surface More pipeline completed')
  } catch (e) {
    const msg = (e as Error).message || 'Unknown pipeline error'
    console.error(`[surface-more] Fatal error for campaign ${campaignId}:`, msg)
    try { await logJobEvent(jobId, 'error', `Pipeline failed: ${msg}`) } catch { /* ignore */ }
    try { await updateJobStatus(jobId, 'failed', msg) } catch { /* ignore */ }
  }
}

// ─── Full Pipeline ───

export async function runFullPipeline(campaignId: string, userId: string, jobId: string): Promise<void> {
  try {
    await updateJobStatus(jobId, 'running')
    await logJobEvent(jobId, 'info', 'Pipeline started')

    // ── Reset previous run state so reruns are idempotent ──
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET pipeline_stage='discovered', scoring_status='not_scored', updated_at=now()
       WHERE campaign_id=$1 AND pipeline_stage IN ('ingested','excluded','scored')`,
      [campaignId]
    )
    await logJobEvent(jobId, 'info', 'Reset campaign creators to discovered state')
    console.log(`[pipeline] Reset campaign creators for rerun`)

    // ── Step 1: Discovery ──
    await updateCampaignStage(campaignId, 'discovery')
    await logJobEvent(jobId, 'info', 'Step 1/3: Discovery — matching DB creators and running LLM discovery')

    const discoveryResult = await runDiscovery(campaignId, userId)
    await logJobEvent(jobId, 'info', `Discovery complete: ${discoveryResult.total_linked} creators linked`, discoveryResult as unknown as Record<string, unknown>)

    if (discoveryResult.total_linked === 0) {
      await logJobEvent(jobId, 'warn', 'No creators discovered — pipeline ending early')
      await updateJobStatus(jobId, 'completed')
      return
    }

    // ── Step 2: Pre-qualification ──
    await updateCampaignStage(campaignId, 'ingestion')
    await logJobEvent(jobId, 'info', 'Step 2/3: Pre-qualification — fetching transcripts & narrowing to top 10')

    const campRes = await dbQuery<{ creative_brief: string }>(
      `SELECT creative_brief FROM ${t('campaigns')} WHERE id = $1`,
      [campaignId]
    )
    const topicsRes = await dbQuery<{ topic: string }>(
      `SELECT topic FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
      [campaignId]
    )

    try {
      const prequalResult = await runPrequalifyPipeline(campaignId, userId, {
        brief: campRes.data[0]?.creative_brief || '',
        topics: topicsRes.data.map(r => r.topic),
      })
      await logJobEvent(jobId, 'info', `Pre-qualification complete: ${prequalResult.selected_count} selected from ${prequalResult.total_discovered}`, {
        ...prequalResult,
        selected_creators: undefined,
      })
    } catch (e) {
      await logJobEvent(jobId, 'warn', `Pre-qualification failed: ${(e as Error).message} — continuing to scoring`)
    }

    // ── Step 3: Scoring ──
    await updateCampaignStage(campaignId, 'scoring')
    await logJobEvent(jobId, 'info', 'Step 3/3: Scoring — evaluating creators with AI')

    const scored = await runScoringBatch(campaignId, userId, jobId)
    console.log(`[pipeline] Scoring batch done: ${scored} creators scored`)
    try { await logJobEvent(jobId, 'info', `Scoring complete: ${scored} creators scored`) } catch { /* ignore */ }

    // ── Done ──
    try { await updateCampaignStage(campaignId, 'review') } catch (e) {
      console.error(`[pipeline] Failed to update campaign stage to review:`, (e as Error).message)
    }
    await updateJobStatus(jobId, 'completed')
    console.log(`[pipeline] Pipeline completed for campaign ${campaignId}`)
    try { await logJobEvent(jobId, 'info', 'Pipeline completed successfully') } catch { /* ignore */ }

  } catch (e) {
    const msg = (e as Error).message || 'Unknown pipeline error'
    console.error(`[pipeline] Fatal error for campaign ${campaignId}:`, msg)
    try { await logJobEvent(jobId, 'error', `Pipeline failed: ${msg}`) } catch { /* ignore */ }
    try {
      await updateJobStatus(jobId, 'failed', msg)
      console.log(`[pipeline] Job ${jobId} marked as failed`)
    } catch (statusErr) {
      console.error(`[pipeline] CRITICAL: Could not mark job ${jobId} as failed:`, (statusErr as Error).message)
    }
  }
}
