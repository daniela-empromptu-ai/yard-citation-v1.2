import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { creator_id, added_by_user_id, source } = await req.json()
    await dbQuery(
      `INSERT INTO campaign_creators (id, campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, created_at, updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,'discovered','not_scored',now(),now())
       ON CONFLICT (campaign_id, creator_id) DO NOTHING`,
      [params.id, creator_id, added_by_user_id, source || 'manual']
    )
    const result = await dbQuery(
      `SELECT * FROM campaign_creators WHERE campaign_id = $1 AND creator_id = $2`,
      [params.id, creator_id]
    )
    // Log activity
    await dbQuery(
      `INSERT INTO activity_log (id, campaign_id, creator_id, actor_user_id, event_type, event_data_json, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,'creator_added','{}',now())`,
      [params.id, creator_id, added_by_user_id]
    )
    return NextResponse.json(result.data[0] || { ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
