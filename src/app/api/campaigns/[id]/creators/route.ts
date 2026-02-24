import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { creator_id, added_by_user_id } = await req.json()
    const result = await dbQuery(
      `INSERT INTO campaign_creators (id, campaign_id, creator_id, added_by_user_id, pipeline_stage, ingestion_status, scoring_status, outreach_state, created_at, updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,'discovered','not_started','not_scored','not_started',now(),now())
       ON CONFLICT (campaign_id, creator_id) DO NOTHING RETURNING *`,
      [params.id, creator_id, added_by_user_id]
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
