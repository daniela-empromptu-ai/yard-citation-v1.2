/**
 * Stage 2 enrichment: generates evidence snippets + content angles for a
 * previously-scored creator. Called lazily from the UI when a user opens
 * a detail panel for a creator scoring >= ENRICH_SCORE_THRESHOLD.
 */

import { dbQuery, dbInsertMany, t } from '@/lib/db'
import { aiEnrichEvaluation } from '@/lib/ai-actions'

export const ENRICH_SCORE_THRESHOLD = 80

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTimestampedText(rawText: string, metadata: Record<string, unknown>): string {
  const segments = metadata?.transcript_segments as Array<{ t: number; d: number; txt: string }> | undefined
  if (!segments || segments.length === 0) return rawText
  return segments.map(s => `[${formatTimestamp(s.t)}] ${s.txt}`).join('\n')
}

export interface EnrichEvaluationResult {
  ok: boolean
  evidence_coverage?: string
  evidence_count?: number
  angle_count?: number
  skipped?: boolean
  error?: string
}

export async function enrichEvaluation(campaignCreatorId: string): Promise<EnrichEvaluationResult> {
  const ctxRes = await dbQuery<{
    eval_id: string; overall_score: number; evidence_coverage: string;
    creator_id: string; creator_name: string; creator_platform: string;
    campaign_brief: string; personas: string[]; campaign_id: string;
  }>(`
    SELECT ev.id as eval_id, ev.overall_score, ev.evidence_coverage,
      c.id as creator_id, c.name as creator_name, c.platform as creator_platform,
      camp.creative_brief as campaign_brief, camp.personas, camp.id as campaign_id
    FROM ${t('creator_evaluations')} ev
    JOIN ${t('campaign_creators')} cc ON cc.id = ev.campaign_creator_id
    JOIN ${t('creators')} c ON c.id = cc.creator_id
    JOIN ${t('campaigns')} camp ON camp.id = cc.campaign_id
    WHERE ev.campaign_creator_id = $1
  `, [campaignCreatorId])

  if (!ctxRes.success || ctxRes.data.length === 0) {
    return { ok: false, error: 'Evaluation not found for this campaign creator' }
  }
  const ctx = ctxRes.data[0]

  if (ctx.overall_score < ENRICH_SCORE_THRESHOLD) {
    return { ok: true, skipped: true, evidence_coverage: ctx.evidence_coverage }
  }

  // Idempotent: if already enriched (coverage != pending), re-run cleans and regenerates.
  const topicsRes = await dbQuery<{ topic: string }>(
    `SELECT topic FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
    [ctx.campaign_id]
  )
  const topics = topicsRes.data.map(r => r.topic)

  const ciRes = await dbQuery<{ id: string; title: string; url: string; platform: string; raw_text: string; metadata_json: Record<string, unknown> }>(
    `SELECT id, title, url, platform, raw_text, metadata_json FROM ${t('content_items')} WHERE creator_id = $1 ORDER BY published_at DESC LIMIT 5`,
    [ctx.creator_id]
  )
  if (ciRes.data.length === 0) {
    return { ok: false, error: 'No content items for creator' }
  }

  const result = await aiEnrichEvaluation({
    campaignBrief: ctx.campaign_brief || '',
    topics,
    personas: Array.isArray(ctx.personas) ? ctx.personas : [],
    creatorName: ctx.creator_name,
    creatorBio: '',
    platforms: [ctx.creator_platform],
    contentItems: ciRes.data.map(ci => ({
      id: ci.id,
      title: ci.title,
      url: ci.url,
      platform: ci.platform,
      raw_text: formatTimestampedText(ci.raw_text, ci.metadata_json || {}),
    })),
  })

  const now = new Date().toISOString()

  await dbQuery(`DELETE FROM ${t('evidence_snippets')} WHERE evaluation_id = $1`, [ctx.eval_id])
  await dbQuery(`DELETE FROM ${t('content_angles')} WHERE evaluation_id = $1`, [ctx.eval_id])

  if (result.evidence_snippets.length > 0) {
    await dbInsertMany(
      t('evidence_snippets'),
      ['evaluation_id', 'content_item_id', 'quote', 'dimension', 'why_it_matters', 'timestamp_start_seconds', 'created_at'],
      result.evidence_snippets.map(es => [ctx.eval_id, es.content_item_id, es.quote, es.dimension, es.why_it_matters, es.timestamp_start_seconds || null, now]),
      'DO NOTHING'
    )
  }

  if (result.content_angles.length > 0) {
    const valueClauses: string[] = []
    const params: unknown[] = []
    let paramIdx = 1
    for (const angle of result.content_angles) {
      valueClauses.push(`($${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++}::jsonb,$${paramIdx++})`)
      params.push(ctx.eval_id, angle.title, angle.format, angle.persona || null, JSON.stringify(angle.key_points || []), now)
    }
    await dbQuery(
      `INSERT INTO ${t('content_angles')} (evaluation_id, title, format, persona, key_points_json, created_at) VALUES ${valueClauses.join(', ')} ON CONFLICT DO NOTHING`,
      params
    )
  }

  await dbQuery(
    `UPDATE ${t('creator_evaluations')} SET evidence_coverage = $1, updated_at = $2 WHERE id = $3`,
    [result.evidence_coverage, now, ctx.eval_id]
  )

  return {
    ok: true,
    evidence_coverage: result.evidence_coverage,
    evidence_count: result.evidence_snippets.length,
    angle_count: result.content_angles.length,
  }
}
