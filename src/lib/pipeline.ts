/**
 * Pipeline orchestrator: chains discover → prequalify → score.
 * Uses jobs + job_events tables for tracking.
 */

import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { fetchSheetRows, parseSheet, groupByCreator } from '@/lib/google-sheets'
import { matchCreatorsToTopics, MatchedCreator } from '@/lib/discovery-scan'
import { runPrequalifyPipeline } from '@/lib/prequalify'
import { scoreCreator } from '@/lib/score-creator'
import { v5 as uuidv5 } from 'uuid'

const CREATOR_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

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

// ─── Discovery ───

export async function runDiscovery(campaignId: string, userId: string, jobId?: string): Promise<number> {
  const log = (msg: string, meta?: Record<string, unknown>) =>
    jobId ? logJobEvent(jobId, 'info', msg, meta) : Promise.resolve()

  // 1. Load search terms (approved), fall back to topics
  const termsRes = await dbQuery<{ term: string }>(
    `SELECT term FROM ${t('campaign_search_terms')} WHERE campaign_id = $1 AND approved = true`,
    [campaignId]
  )
  let searchStrings = termsRes.data.map(r => r.term)

  if (searchStrings.length === 0) {
    const topicsRes = await dbQuery<{ topic: string }>(
      `SELECT topic FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
      [campaignId]
    )
    searchStrings = topicsRes.data.map(r => r.topic)
  }

  if (searchStrings.length === 0) {
    throw new Error('No approved search terms or topics found for discovery')
  }

  await log(`Starting discovery with ${searchStrings.length} search terms`)
  console.log(`[discovery] Starting with ${searchStrings.length} search terms`)

  // 2. Fetch Google Sheet
  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (!sheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not configured')
  }

  console.log(`[discovery] Fetching Google Sheet ${sheetId}...`)
  const rawRows = await fetchSheetRows(sheetId)
  if (rawRows.length < 1) {
    throw new Error('Sheet is empty or has no data rows')
  }
  console.log(`[discovery] Sheet fetched: ${rawRows.length} rows`)

  const { rows: dataRows, warnings } = parseSheet(rawRows)
  if (dataRows.length === 0) {
    throw new Error('No data rows found in sheet')
  }

  // 3. Group by creator and match
  const grouped = groupByCreator(dataRows)
  const matched = matchCreatorsToTopics(grouped, searchStrings, 20)
  console.log(`[discovery] Matched ${matched.length} creators from ${grouped.length} grouped`)

  await log(`Matched ${matched.length} creators from ${dataRows.length} rows`, { warnings })

  // 4. Upsert to DB
  console.log(`[discovery] Upserting ${matched.length} creators to DB...`)
  const now = new Date().toISOString()
  for (let mi = 0; mi < matched.length; mi++) {
    const creator = matched[mi]
    const creatorUuid = uuidv5(creator.creator_id, CREATOR_UUID_NAMESPACE)

    const creatorParams = [
      creatorUuid,
      creator.creator_name,
      creator.creator_channel || creator.platforms[0]?.platform_username || null,
      creator.primary_topics,
      creator.primary_language ? [creator.primary_language] : [],
      creator.country ? [creator.country] : [],
      creator.active_status ? creator.active_status.toLowerCase() !== 'active' : false,
      creator.last_active_at || null,
      now,
    ]
    await dbQuery(
      `INSERT INTO ${t('creators')} (id, display_name, primary_handle, topics, languages, geo_focus, is_dormant, last_content_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT DO NOTHING`,
      creatorParams
    )
    await dbQuery(
      `UPDATE ${t('creators')} SET display_name=$2, primary_handle=$3, topics=$4, languages=$5, geo_focus=$6, is_dormant=$7, last_content_date=$8, updated_at=$9 WHERE id=$1`,
      creatorParams
    )

    // Platform account
    const plat = creator.platforms[0]
    if (plat?.platform_url) {
      await dbQuery(
        `INSERT INTO ${t('creator_platform_accounts')} (id, creator_id, platform, handle, url, follower_count, metrics_json, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7)
         ON CONFLICT DO NOTHING`,
        [creatorUuid, plat.platform, plat.platform_username || null, plat.platform_url, plat.follower_count, JSON.stringify(plat.metrics), now]
      )
    }

    // Link to campaign
    await dbQuery(
      `INSERT INTO ${t('campaign_creators')} (id, campaign_id, creator_id, added_by_user_id, pipeline_stage, ingestion_status, scoring_status, outreach_state, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'discovered', 'not_started', 'not_scored', 'not_started', $4, $5)
       ON CONFLICT DO NOTHING`,
      [campaignId, creatorUuid, userId, now, now]
    )
    if ((mi + 1) % 10 === 0 || mi === matched.length - 1) {
      console.log(`[discovery] Upserted ${mi + 1}/${matched.length} creators`)
    }
  }

  // 5. Log activity
  await dbQuery(
    `INSERT INTO ${t('activity_log')} (campaign_id, actor_user_id, event_type, event_data_json, created_at)
     VALUES ($1, $2, 'discovery_scan', $3::jsonb, now())`,
    [campaignId, userId, JSON.stringify({
      total_sheet_rows: dataRows.length,
      grouped_creators: grouped.length,
      matched: matched.length,
    })]
  )

  await log(`Discovery complete: ${matched.length} creators inserted`)
  return matched.length
}

// ─── Scoring Batch ───

export async function runScoringBatch(campaignId: string, userId: string, jobId?: string): Promise<number> {
  const log = (msg: string, meta?: Record<string, unknown>) =>
    jobId ? logJobEvent(jobId, 'info', msg, meta) : Promise.resolve()

  // Load ingested creators that need scoring
  const ccRes = await dbQuery<{ id: string; creator_name: string }>(
    `SELECT cc.id, c.display_name as creator_name
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
  for (const cc of ccRes.data) {
    try {
      const result = await scoreCreator(cc.id)

      if (result.ok) {
        scored++
        console.log(`[pipeline] Scored ${cc.creator_name}: ${result.overall_score}/100`)
        await log(`Scored ${cc.creator_name}: ${result.overall_score}/100`, {
          creator: cc.creator_name,
          score: result.overall_score,
          coverage: result.evidence_coverage,
        })
      } else {
        console.log(`[pipeline] Scoring failed for ${cc.creator_name}: ${result.error}`)
        await log(`Scoring failed for ${cc.creator_name}: ${result.error}`)
      }
    } catch (e) {
      console.error(`[pipeline] Scoring error for ${cc.creator_name}:`, (e as Error).message)
      try { await log(`Scoring error for ${cc.creator_name}: ${(e as Error).message}`) } catch { /* ignore */ }
    }
  }

  await log(`Scoring complete: ${scored}/${ccRes.data.length} scored`)
  return scored
}

// ─── Full Pipeline ───

export async function runFullPipeline(campaignId: string, userId: string, jobId: string): Promise<void> {
  try {
    await updateJobStatus(jobId, 'running')
    await logJobEvent(jobId, 'info', 'Pipeline started')

    // ── Reset previous run state so reruns are idempotent ──
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET pipeline_stage='discovered', scoring_status='not_scored', ingestion_status='not_started', ingestion_error=NULL, scoring_error=NULL, updated_at=now()
       WHERE campaign_id=$1 AND pipeline_stage IN ('ingested','excluded','scored','needs_manual_review')`,
      [campaignId]
    )
    await logJobEvent(jobId, 'info', 'Reset campaign creators to discovered state')
    console.log(`[pipeline] Reset campaign creators for rerun`)

    // ── Step 1: Discovery ──
    await updateCampaignStage(campaignId, 'discovery')
    await logJobEvent(jobId, 'info', 'Step 1/3: Discovery — scanning Google Sheet for matching creators')

    const discovered = await runDiscovery(campaignId, userId, jobId)
    if (discovered === 0) {
      await logJobEvent(jobId, 'warn', 'No creators discovered — pipeline ending early')
      await updateJobStatus(jobId, 'completed')
      return
    }

    // ── Step 2: Pre-qualification ──
    await updateCampaignStage(campaignId, 'ingestion')
    await logJobEvent(jobId, 'info', 'Step 2/3: Pre-qualification — fetching transcripts & narrowing to top 10')

    // Load campaign context for prequalify
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
    await logJobEvent(jobId, 'info', `Scoring complete: ${scored} creators scored`)

    // ── Done ──
    await updateCampaignStage(campaignId, 'review')
    await updateJobStatus(jobId, 'completed')
    await logJobEvent(jobId, 'info', 'Pipeline completed successfully')

  } catch (e) {
    const msg = (e as Error).message || 'Unknown pipeline error'
    console.error(`[pipeline] Fatal error for campaign ${campaignId}:`, e)
    try { await logJobEvent(jobId, 'error', `Pipeline failed: ${msg}`) } catch { /* ignore logging failure */ }
    try { await updateJobStatus(jobId, 'failed', msg) } catch (statusErr) {
      console.error(`[pipeline] CRITICAL: Could not mark job ${jobId} as failed:`, statusErr)
    }
  }
}
