import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'

interface RouteContext {
  params: { id: string; creatorId: string }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id: campaignId, creatorId } = params
  const { reason } = await req.json()

  const notes = JSON.stringify({
    dismissed: true,
    reason: reason || null,
    dismissed_at: new Date().toISOString(),
  })

  const res = await dbQuery(
    `UPDATE ${t('campaign_creators')}
     SET pipeline_stage = 'dismissed', notes = $1, updated_at = now()
     WHERE campaign_id = $2 AND id = $3`,
    [notes, campaignId, creatorId]
  )

  if (!res.success) {
    return NextResponse.json({ error: 'Failed to dismiss creator' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
