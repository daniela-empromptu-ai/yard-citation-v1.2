/**
 * Core scoring logic extracted so both the API route and the pipeline
 * can call it directly (no self-referential HTTP fetch).
 * Uses the builder API (setupPrompt/applyPrompt) via aiScoreCreator,
 * consistent with the rest of the app.
 */

import { dbQuery, t } from '@/lib/db'
import { aiScoreCreator } from '@/lib/ai-actions'
import { validateEvidenceQuotes } from '@/lib/evidence-validation'

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
    creator_name: string; bio: string; topics: string[]; languages: string[];
    is_dormant: boolean; is_autodubbed_suspected: boolean; competitor_affiliated: boolean;
    campaign_brief: string; product_category: string; personas: string; prompt_gaps: string;
  }>(`
    SELECT cc.id as cc_id, cc.campaign_id, cc.creator_id,
      c.display_name as creator_name, c.bio, c.topics, c.languages,
      c.is_dormant, c.is_autodubbed_suspected, c.competitor_affiliated,
      camp.creative_brief as campaign_brief, camp.product_category,
      (SELECT string_agg(persona_name, ', ') FROM ${t('campaign_personas')} WHERE campaign_id = camp.id) as personas,
      (SELECT string_agg(prompt_text, ' | ') FROM ${t('campaign_prompt_gaps')} WHERE campaign_id = camp.id AND status = 'approved') as prompt_gaps
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
    `SELECT id, title, url, platform, raw_text, metadata_json, published_at FROM ${t('content_items')} WHERE creator_id = $1 ORDER BY published_at DESC LIMIT 10`,
    [ctx.creator_id]
  )

  const contentItems = ciRes.data

  if (contentItems.length === 0) {
    return { ok: false, overall_score: 0, evidence_coverage: 'none', needs_manual_review: false, error: 'No content items found. Please ingest content first.' }
  }

  const now = new Date().toISOString()

  // Call AI scoring via builder API (consistent with rest of app)
  const scoringResult = await aiScoreCreator({
    campaignBrief: ctx.campaign_brief || '',
    topics: ctx.topics || [],
    personas: ctx.personas ? ctx.personas.split(', ') : [],
    promptGaps: ctx.prompt_gaps ? ctx.prompt_gaps.split(' | ') : [],
    creatorName: ctx.creator_name,
    creatorBio: ctx.bio || '',
    platforms: ctx.languages || [],
    contentItems: contentItems.map(ci => ({
      id: ci.id,
      title: ci.title,
      url: ci.url,
      platform: ci.platform,
      raw_text: ci.raw_text,
    })),
  })

  const computedScore = scoringResult.overall_score
  const coverage = scoringResult.evidence_coverage
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

  const evalId = evalRes.data[0]?.id
  if (evalId) {
    for (const es of (scoringResult.evidence_snippets || [])) {
      await dbQuery(
        `INSERT INTO ${t('evidence_snippets')} (evaluation_id, content_item_id, quote, dimension, why_it_matters, timestamp_start_seconds, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [evalId, es.content_item_id, es.quote, es.dimension, es.why_it_matters, es.timestamp_start_seconds || null, now]
      )
    }
    for (const angle of (scoringResult.content_angles || [])) {
      await dbQuery(
        `INSERT INTO ${t('content_angles')} (evaluation_id, title, format, persona, key_points_json, created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
        [evalId, angle.title, angle.format, angle.persona || null, JSON.stringify(angle.key_points || []), now]
      )
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
  }

  return { ok: true, evaluation_id: evalId, overall_score: computedScore, evidence_coverage: coverage, needs_manual_review: needsManualReview }
}
