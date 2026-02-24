import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET() {
  try {
    const result = await dbQuery(
      `SELECT cc.*, cr.display_name, cr.primary_handle,
         camp.name as campaign_name, camp.id as campaign_id,
         ce.overall_score, ce.evidence_coverage,
         op.id as packet_id, op.subject,
         u.name as outreach_owner_name
       FROM campaign_creators cc
       JOIN creators cr ON cr.id = cc.creator_id
       JOIN campaigns camp ON camp.id = cc.campaign_id
       LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = cc.id
       LEFT JOIN outreach_packets op ON op.campaign_creator_id = cc.id
       LEFT JOIN app_users u ON u.id = cc.outreach_owner_user_id
       WHERE cc.pipeline_stage IN ('outreach_ready','contacted','booked')
          OR cc.outreach_state != 'not_started'
       ORDER BY cc.last_outreach_at DESC NULLS LAST`,
      []
    )
    return NextResponse.json(result.data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
