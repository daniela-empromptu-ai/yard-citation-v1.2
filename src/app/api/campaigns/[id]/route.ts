import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [campaign, personas, topics, searchTerms, creators, activity] = await Promise.all([
      dbQuery(
        `SELECT c.*, cl.name as client_name, u.name as owner_name, u2.name as collaborator_name
         FROM campaigns c
         JOIN clients cl ON cl.id = c.client_id
         JOIN app_users u ON u.id = c.owner_user_id
         LEFT JOIN app_users u2 ON u2.id = c.collaborator_user_id
         WHERE c.id = $1`,
        [params.id]
      ),
      dbQuery(`SELECT * FROM campaign_personas WHERE campaign_id = $1`, [params.id]),
      dbQuery(`SELECT * FROM campaign_topics WHERE campaign_id = $1 ORDER BY order_index`, [params.id]),
      dbQuery(`SELECT *, u.name as approved_by_name FROM campaign_search_terms cst LEFT JOIN app_users u ON u.id = cst.approved_by_user_id WHERE cst.campaign_id = $1 ORDER BY cst.order_index`, [params.id]),
      dbQuery(
        `SELECT cc.*, cr.display_name, cr.primary_handle, cr.is_dormant, cr.is_autodubbed_suspected, cr.competitor_affiliated,
           ce.overall_score, ce.evidence_coverage, ce.needs_manual_review,
           (SELECT COUNT(*)::int FROM content_items ci WHERE ci.creator_id = cr.id AND ci.campaign_id = $1) as content_item_count
         FROM campaign_creators cc
         JOIN creators cr ON cr.id = cc.creator_id
         LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = cc.id
         WHERE cc.campaign_id = $1
         ORDER BY cc.created_at`,
        [params.id]
      ),
      dbQuery(
        `SELECT al.*, u.name as actor_name FROM activity_log al LEFT JOIN app_users u ON u.id = al.actor_user_id
         WHERE al.campaign_id = $1 ORDER BY al.created_at DESC LIMIT 20`,
        [params.id]
      ),
    ])

    if (!campaign.data.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      campaign: campaign.data[0],
      personas: personas.data,
      topics: topics.data,
      searchTerms: searchTerms.data,
      creators: creators.data,
      activity: activity.data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const sets: string[] = []
    const vals: unknown[] = []
    let i = 1
    for (const [k, v] of Object.entries(body)) {
      sets.push(`${k} = $${i++}`)
      vals.push(v)
    }
    sets.push(`updated_at = now()`)
    vals.push(params.id)
    await dbQuery(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${i}`, vals)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
