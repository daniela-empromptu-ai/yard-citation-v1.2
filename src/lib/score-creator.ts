/**
 * Core scoring logic (Stage 1 only): scores + rationale + strengths/weaknesses.
 * Evidence snippets and content angles are generated lazily via enrichEvaluation
 * when a user opens a high-scoring creator's detail panel.
 */

import { dbQuery, t } from '@/lib/db'
import { aiScoreCreator } from '@/lib/ai-actions'

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * If metadata_json contains transcript_segments, format raw_text with [M:SS] timestamps.
 */
function formatTimestampedText(rawText: string, metadata: Record<string, unknown>): string {
  const segments = metadata?.transcript_segments as Array<{ t: number; d: number; txt: string }> | undefined
  if (!segments || segments.length === 0) return rawText

  return segments.map(s => `[${formatTimestamp(s.t)}] ${s.txt}`).join('\n')
}

export interface ScoreCreatorResult {
  ok: boolean
  evaluation_id?: string
  overall_score: number
  evidence_coverage: string
  needs_manual_review: boolean
  error?: string
}

export async function scoreCreator(campaignCreatorId: string): Promise<ScoreCreatorResult> {
  const ccRes = await dbQuery<{
    cc_id: string; campaign_id: string; creator_id: string;
    creator_name: string; creator_platform: string; creator_handle: string | null;
    campaign_brief: string; product_category: string; personas: string[];
  }>(`
    SELECT cc.id as cc_id, cc.campaign_id, cc.creator_id,
      c.name as creator_name, c.platform as creator_platform, c.handle as creator_handle,
      camp.creative_brief as campaign_brief, camp.product_category, camp.personas
    FROM ${t('campaign_creators')} cc
    JOIN ${t('creators')} c ON c.id = cc.creator_id
    JOIN ${t('campaigns')} camp ON camp.id = cc.campaign_id
    WHERE cc.id = $1
  `, [campaignCreatorId])

  if (!ccRes.success || ccRes.data.length === 0) {
    return { ok: false, overall_score: 0, evidence_coverage: 'none', needs_manual_review: false, error: 'Campaign creator not found' }
  }

  const ctx = ccRes.data[0]
  const ciRes = await dbQuery<{ id: string; title: string; url: string; platform: string; raw_text: string; metadata_json: Record<string, unknown>; published_at: string }>(
    `SELECT id, title, url, platform, raw_text, metadata_json, published_at FROM ${t('content_items')} WHERE creator_id = $1 ORDER BY published_at DESC LIMIT 5`,
    [ctx.creator_id]
  )

  const contentItems = ciRes.data

  if (contentItems.length === 0) {
    return { ok: false, overall_score: 0, evidence_coverage: 'none', needs_manual_review: false, error: 'No content items found. Please ingest content first.' }
  }

  const now = new Date().toISOString()

  // Load campaign topics for scoring context
  const topicsRes = await dbQuery<{ topic: string }>(
    `SELECT topic FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
    [ctx.campaign_id]
  )
  const topics = topicsRes.data.map(r => r.topic)

  // Call AI scoring via builder API (consistent with rest of app)
  const scoringResult = await aiScoreCreator({
    campaignBrief: ctx.campaign_brief || '',
    topics,
    personas: Array.isArray(ctx.personas) ? ctx.personas : [],
    promptGaps: [],
    creatorName: ctx.creator_name,
    creatorBio: '',
    platforms: [ctx.creator_platform],
    contentItems: contentItems.map(ci => ({
      id: ci.id,
      title: ci.title,
      url: ci.url,
      platform: ci.platform,
      raw_text: formatTimestampedText(ci.raw_text, ci.metadata_json || {}),
    })),
  })

  const computedScore = scoringResult.overall_score
  // Evidence coverage starts as 'pending'; finalized by enrichEvaluation (Stage 2).
  const coverage = 'pending'
  const needsManualReview = scoringResult.needs_manual_review
  const nmrReason = scoringResult.needs_manual_review_reason || null

  await dbQuery(`DELETE FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1`, [campaignCreatorId])

  const evalRes = await dbQuery<{ id: string }>(
    `INSERT INTO ${t('creator_evaluations')} (campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, needs_manual_review_reason, overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit, strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
     VALUES ($1,'builder_api','claude-via-builder',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16) RETURNING id`,
    [campaignCreatorId, now, coverage, needsManualReview, nmrReason, computedScore,
     scoringResult.score_technical_relevance, scoringResult.score_audience_alignment, scoringResult.score_content_quality,
     scoringResult.score_channel_performance, scoringResult.score_brand_fit,
     JSON.stringify(scoringResult.strengths || []), JSON.stringify(scoringResult.weaknesses || []),
     scoringResult.rationale_md || '', now, now]
  )

  // Builder API proxy may not return RETURNING data — fallback to query
  let evalId = evalRes.data[0]?.id
  if (!evalId) {
    const fallback = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [campaignCreatorId]
    )
    evalId = fallback.data[0]?.id
  }

  if (!evalId) {
    console.error(`[score-creator] ${ctx.creator_name}: evaluation inserted but ID not retrievable`)
    return { ok: false, overall_score: computedScore, evidence_coverage: coverage, needs_manual_review: needsManualReview, error: 'Evaluation saved but ID not retrievable' }
  }

  const newStage = needsManualReview ? 'needs_manual_review' : 'scored'
  await dbQuery(
    `UPDATE ${t('campaign_creators')} SET scoring_status='scored', pipeline_stage=$1, updated_at=$2 WHERE id=$3`,
    [newStage, now, campaignCreatorId]
  )
  await dbQuery(
    `INSERT INTO ${t('activity_log')} (campaign_id, creator_id, campaign_creator_id, event_type, event_data_json, created_at)
     SELECT cc.campaign_id, cc.creator_id, $1, 'evaluation_completed', $2::jsonb, $3
     FROM ${t('campaign_creators')} cc WHERE cc.id = $1`,
    [campaignCreatorId, JSON.stringify({ score: computedScore, coverage, needs_manual_review: needsManualReview }), now]
  )

  return { ok: true, evaluation_id: evalId, overall_score: computedScore, evidence_coverage: coverage, needs_manual_review: needsManualReview }
}
