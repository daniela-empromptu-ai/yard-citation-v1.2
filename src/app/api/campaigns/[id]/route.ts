import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [campaign, topics, searchTerms, creators, activity] = await Promise.all([
      dbQuery(
        `SELECT c.*, cl.name as client_name, u.name as owner_name
         FROM campaigns c
         JOIN clients cl ON cl.id = c.client_id
         JOIN app_users u ON u.id = c.owner_user_id
         WHERE c.id = $1`,
        [params.id]
      ),
      dbQuery(`SELECT * FROM campaign_topics WHERE campaign_id = $1 ORDER BY order_index`, [params.id]),
      dbQuery(`SELECT *, u.name as approved_by_name FROM campaign_search_terms cst LEFT JOIN app_users u ON u.id = cst.approved_by_user_id WHERE cst.campaign_id = $1 ORDER BY cst.order_index`, [params.id]),
      dbQuery(
        `SELECT cc.id, cc.campaign_id, cc.creator_id, cc.source, cc.pipeline_stage, cc.scoring_status, cc.created_at, cc.updated_at,
           cr.name as creator_name, cr.platform as creator_platform, cr.handle as creator_handle,
           ce.overall_score, ce.evidence_coverage, ce.needs_manual_review, ce.evaluated_at,
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
      topics: topics.data,
      searchTerms: searchTerms.data,
      creators: creators.data,
      activity: activity.data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    // Delete in FK order: evaluation leaves → evaluations → campaign joins → campaign
    // Batch via subqueries instead of N+1 loops
    await dbQuery('DELETE FROM evidence_snippets WHERE evaluation_id IN (SELECT id FROM creator_evaluations WHERE campaign_creator_id IN (SELECT id FROM campaign_creators WHERE campaign_id = $1))', [id])
    await dbQuery('DELETE FROM content_angles WHERE evaluation_id IN (SELECT id FROM creator_evaluations WHERE campaign_creator_id IN (SELECT id FROM campaign_creators WHERE campaign_id = $1))', [id])
    await dbQuery('DELETE FROM creator_evaluations WHERE campaign_creator_id IN (SELECT id FROM campaign_creators WHERE campaign_id = $1)', [id])
    await dbQuery('DELETE FROM campaign_creators WHERE campaign_id = $1', [id])
    await dbQuery('DELETE FROM content_items WHERE campaign_id = $1', [id])
    await dbQuery('DELETE FROM campaign_search_terms WHERE campaign_id = $1', [id])
    await dbQuery('DELETE FROM campaign_topics WHERE campaign_id = $1', [id])
    await dbQuery('DELETE FROM activity_log WHERE campaign_id = $1', [id])
    await dbQuery('DELETE FROM job_events WHERE job_id IN (SELECT id FROM jobs WHERE campaign_id = $1)', [id])
    await dbQuery('DELETE FROM jobs WHERE campaign_id = $1', [id])
    await dbQuery('DELETE FROM campaigns WHERE id = $1', [id])
    return NextResponse.json({ ok: true, deleted: id })
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
