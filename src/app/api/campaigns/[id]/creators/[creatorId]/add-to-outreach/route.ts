import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { aiGenerateOutreachDraft } from '@/lib/ai-actions'

interface RouteContext {
  params: { id: string; creatorId: string }
}

/**
 * Add a creator to the outreach queue. Steps:
 *   1. Idempotent: bail with existing packet if one already exists.
 *   2. Insert outreach_packets row with placeholder subject/body.
 *   3. Update campaign_creators.outreach_state = 'drafting'.
 *   4. Call generate_outreach_draft prompt; persist result.
 *   5. Insert outreach_activity row + activity_log event.
 *
 * The route is fast (returns after step 3) and does steps 4-5
 * synchronously after — total ~3-15s depending on the LLM.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: campaignId, creatorId: ccId } = params
  const { user_id, selection_note } = await req.json().catch(() => ({}))
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  if (selection_note && typeof selection_note === 'string' && selection_note.trim()) {
    await dbQuery(
      `INSERT INTO ${t('activity_log')} (campaign_id, campaign_creator_id, actor_user_id, event_type, event_data_json, created_at)
       VALUES ($1, $2, $3, 'creator_selected_note', $4::jsonb, now())`,
      [campaignId, ccId, user_id, JSON.stringify({ note: selection_note.trim() })]
    )
  }

  const ownerRes = await dbQuery<{ name: string }>(
    `SELECT u.name FROM ${t('app_users')} u JOIN ${t('campaigns')} c ON c.owner_user_id = u.id WHERE c.id = $1`,
    [campaignId]
  )
  const rawName = ownerRes.data[0]?.name || ''
  const rawFirst = rawName.split(' ')[0]
  const senderName = (rawFirst && !/admin/i.test(rawName)) ? rawFirst : 'Michael'

  // Idempotency
  const existing = await dbQuery<{ id: string }>(
    `SELECT id FROM ${t('outreach_packets')} WHERE campaign_creator_id = $1`,
    [ccId]
  )
  if (existing.data.length > 0) {
    return NextResponse.json({ ok: true, packet_id: existing.data[0].id, already_exists: true })
  }

  // Load context for the LLM
  const campRes = await dbQuery<{ name: string; creative_brief: string }>(
    `SELECT name, creative_brief FROM ${t('campaigns')} WHERE id = $1`,
    [campaignId]
  )
  if (campRes.data.length === 0) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const ccRes = await dbQuery<{ creator_id: string; name: string; platform: string; handle: string | null }>(
    `SELECT cc.creator_id, c.name, c.platform, c.handle
     FROM ${t('campaign_creators')} cc JOIN ${t('creators')} c ON c.id = cc.creator_id
     WHERE cc.id = $1`,
    [ccId]
  )
  if (ccRes.data.length === 0) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  const cc = ccRes.data[0]

  // Pull top angle + top 3 evidence snippets if a recent evaluation exists
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

  // Insert packet immediately with placeholder, mark drafting state
  const packetId = uuidv4()
  await dbQuery(
    `INSERT INTO ${t('outreach_packets')}
     (id, campaign_creator_id, created_by_user_id, subject, body_md, followup_plan_json, last_updated_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, now(), now())`,
    [packetId, ccId, user_id, '(generating…)', '(generating…)', '[]']
  )
  await dbQuery(
    `UPDATE ${t('campaign_creators')}
     SET outreach_state = 'drafting', outreach_owner_user_id = $1, updated_at = now()
     WHERE id = $2`,
    [user_id, ccId]
  )

  // Generate draft via builder prompt
  try {
    const draft = await aiGenerateOutreachDraft({
      campaignName: campRes.data[0].name,
      campaignBrief: campRes.data[0].creative_brief || '',
      creatorName: cc.name,
      platforms: [cc.platform],
      selectedAngle: topAngle,
      evidenceSnippets: snippets,
      senderName,
    })

    await dbQuery(
      `UPDATE ${t('outreach_packets')}
       SET subject = $2, body_md = $3, followup_plan_json = $4::jsonb, last_updated_at = now()
       WHERE id = $1`,
      [packetId, draft.subject, draft.body_md, JSON.stringify(draft.followup_plan || [])]
    )
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET outreach_state = 'draft', updated_at = now() WHERE id = $1`,
      [ccId]
    )
    await dbQuery(
      `INSERT INTO ${t('outreach_activity')} (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at)
       VALUES ($1, $2, $3, 'email', 'drafted', 'draft', now())`,
      [uuidv4(), ccId, user_id]
    )
    await dbQuery(
      `INSERT INTO ${t('activity_log')} (campaign_id, actor_user_id, event_type, event_data_json, created_at)
       VALUES ($1, $2, 'outreach_drafted', $3::jsonb, now())`,
      [campaignId, user_id, JSON.stringify({ packet_id: packetId, creator: cc.name })]
    )
    return NextResponse.json({ ok: true, packet_id: packetId, status: 'draft' })
  } catch (e) {
    const msg = (e as Error).message
    console.error('[add-to-outreach] LLM failed:', msg)
    await dbQuery(
      `UPDATE ${t('outreach_packets')}
       SET subject = '(draft generation failed)', body_md = $2, last_updated_at = now()
       WHERE id = $1`,
      [packetId, `Draft generation failed: ${msg}\n\nClick Edit to write the email manually.`]
    )
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET outreach_state = 'draft', updated_at = now() WHERE id = $1`,
      [ccId]
    )
    return NextResponse.json({ ok: true, packet_id: packetId, status: 'draft_failed', error: msg }, { status: 200 })
  }
}
