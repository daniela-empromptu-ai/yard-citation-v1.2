import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'

interface PacketRow {
  id: string
  campaign_creator_id: string
  subject: string
  body_md: string
  followup_plan_json: unknown
  last_updated_at: string
  created_at: string
  outreach_state: string | null
  creator_name: string
  creator_platform: string
  overall_score: number | null
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await dbQuery<PacketRow>(
    `SELECT
       op.id, op.campaign_creator_id, op.subject, op.body_md, op.followup_plan_json,
       op.last_updated_at, op.created_at,
       cc.outreach_state,
       c.name AS creator_name, c.platform AS creator_platform,
       ev.overall_score
     FROM ${t('outreach_packets')} op
     JOIN ${t('campaign_creators')} cc ON cc.id = op.campaign_creator_id
     JOIN ${t('creators')} c ON c.id = cc.creator_id
     LEFT JOIN LATERAL (
       SELECT overall_score FROM ${t('creator_evaluations')}
       WHERE campaign_creator_id = cc.id ORDER BY created_at DESC LIMIT 1
     ) ev ON true
     WHERE cc.campaign_id = $1
     ORDER BY op.last_updated_at DESC`,
    [params.id]
  )
  return NextResponse.json({ packets: res.data })
}
