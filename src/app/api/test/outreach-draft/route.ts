import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { aiGenerateOutreachDraft } from '@/lib/ai-actions'

/**
 * Isolated outreach draft test.
 * POST /api/test/outreach-draft
 * Body: { campaign_creator_id: string }
 *
 * Returns the full context fed to the LLM alongside the generated draft,
 * so you can verify evidence snippets are actually being passed.
 */
export async function POST(req: NextRequest) {
  const { campaign_creator_id: ccId } = await req.json().catch(() => ({}))
  if (!ccId) return NextResponse.json({ error: 'campaign_creator_id required' }, { status: 400 })

  // Load creator + campaign
  const ccRes = await dbQuery<{ creator_id: string; name: string; platform: string; handle: string | null; campaign_id: string }>(
    `SELECT cc.creator_id, c.name, c.platform, c.handle, cc.campaign_id
     FROM ${t('campaign_creators')} cc JOIN ${t('creators')} c ON c.id = cc.creator_id
     WHERE cc.id = $1`,
    [ccId]
  )
  if (ccRes.data.length === 0) return NextResponse.json({ error: 'campaign_creator not found' }, { status: 404 })
  const cc = ccRes.data[0]

  const campRes = await dbQuery<{ name: string; creative_brief: string }>(
    `SELECT name, creative_brief FROM ${t('campaigns')} WHERE id = $1`,
    [cc.campaign_id]
  )
  if (campRes.data.length === 0) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

  // Load latest evaluation
  const evalRes = await dbQuery<{ id: string }>(
    `SELECT id FROM ${t('creator_evaluations')}
     WHERE campaign_creator_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [ccId]
  )

  let topAngle: { title: string; format: string; key_points: string[] } | null = null
  let snippets: Array<{ quote: string; url: string; why_it_matters: string }> = []

  if (evalRes.data.length > 0) {
    const evalId = evalRes.data[0].id

    const angleRes = await dbQuery<{ title: string; format: string; key_points_json: string[] | string | null }>(
      `SELECT title, format, key_points_json FROM ${t('content_angles')}
       WHERE evaluation_id = $1 ORDER BY created_at LIMIT 1`,
      [evalId]
    )
    if (angleRes.data.length > 0) {
      const a = angleRes.data[0]
      const points = Array.isArray(a.key_points_json)
        ? a.key_points_json
        : (typeof a.key_points_json === 'string' ? JSON.parse(a.key_points_json) : [])
      topAngle = { title: a.title, format: a.format, key_points: points }
    }

    const evRes = await dbQuery<{ quote: string; url: string | null; why_it_matters: string | null }>(
      `SELECT es.quote, ci.url, es.why_it_matters
       FROM ${t('evidence_snippets')} es
       LEFT JOIN ${t('content_items')} ci ON ci.id = es.content_item_id
       WHERE es.evaluation_id = $1 ORDER BY es.created_at LIMIT 3`,
      [evalId]
    )
    snippets = evRes.data.map(r => ({
      quote: r.quote || '',
      url: r.url || '',
      why_it_matters: r.why_it_matters || '',
    }))
  }

  const context = {
    campaign: campRes.data[0].name,
    creator: cc.name,
    platform: cc.platform,
    eval_found: evalRes.data.length > 0,
    eval_id: evalRes.data[0]?.id || null,
    angle: topAngle,
    snippets,
    snippet_count: snippets.length,
  }

  console.log('[test/outreach-draft] context:', JSON.stringify(context, null, 2))

  const draft = await aiGenerateOutreachDraft({
    campaignName: campRes.data[0].name,
    campaignBrief: campRes.data[0].creative_brief || '',
    creatorName: cc.name,
    platforms: [cc.platform],
    selectedAngle: topAngle,
    evidenceSnippets: snippets,
    senderName: 'Michael',
  })

  return NextResponse.json({ context, draft })
}
