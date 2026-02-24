import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [creator, platforms, flags, pricing, notes, campaigns, contentItems, evaluations] = await Promise.all([
      dbQuery(`SELECT * FROM creators WHERE id = $1`, [params.id]),
      dbQuery(`SELECT * FROM creator_platform_accounts WHERE creator_id = $1`, [params.id]),
      dbQuery(`SELECT csf.*, u.name as set_by_name FROM creator_status_flags csf LEFT JOIN app_users u ON u.id = csf.set_by_user_id WHERE csf.creator_id = $1 ORDER BY csf.set_at DESC`, [params.id]),
      dbQuery(`SELECT * FROM creator_pricing WHERE creator_id = $1`, [params.id]),
      dbQuery(`SELECT cn.*, u.name as created_by_name FROM creator_notes cn LEFT JOIN app_users u ON u.id = cn.created_by_user_id WHERE cn.creator_id = $1 ORDER BY cn.created_at DESC`, [params.id]),
      dbQuery(
        `SELECT cc.*, camp.name as campaign_name, camp.status as campaign_status,
           ce.overall_score, ce.evidence_coverage
         FROM campaign_creators cc
         JOIN campaigns camp ON camp.id = cc.campaign_id
         LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = cc.id
         WHERE cc.creator_id = $1
         ORDER BY cc.created_at DESC`,
        [params.id]
      ),
      dbQuery(
        `SELECT * FROM content_items WHERE creator_id = $1 ORDER BY published_at DESC LIMIT 10`,
        [params.id]
      ),
      dbQuery(
        `SELECT ce.*, camp.name as campaign_name
         FROM creator_evaluations ce
         JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
         JOIN campaigns camp ON camp.id = cc.campaign_id
         WHERE cc.creator_id = $1
         ORDER BY ce.evaluated_at DESC`,
        [params.id]
      ),
    ])

    if (!creator.data.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      creator: creator.data[0],
      platforms: platforms.data,
      flags: flags.data,
      pricing: pricing.data,
      notes: notes.data,
      campaigns: campaigns.data,
      contentItems: contentItems.data,
      evaluations: evaluations.data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
