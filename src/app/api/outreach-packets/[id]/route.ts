import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await dbQuery(
    `SELECT * FROM ${t('outreach_packets')} WHERE id = $1`,
    [params.id]
  )
  return NextResponse.json({ packet: res.data[0] || null })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const packetId = params.id

  // Fetch campaign_creator_id before deleting
  const ref = await dbQuery<{ campaign_creator_id: string }>(
    `SELECT campaign_creator_id FROM ${t('outreach_packets')} WHERE id = $1`,
    [packetId]
  )
  if (ref.data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ccId = ref.data[0].campaign_creator_id

  // Delete dependents first (FK order)
  await dbQuery(`DELETE FROM ${t('outreach_packet_evidence')} WHERE outreach_packet_id = $1`, [packetId])
  await dbQuery(`DELETE FROM ${t('outreach_activity')} WHERE campaign_creator_id = $1`, [ccId])
  await dbQuery(`DELETE FROM ${t('outreach_packets')} WHERE id = $1`, [packetId])

  // Reset creator outreach state so they can be re-added
  await dbQuery(
    `UPDATE ${t('campaign_creators')} SET outreach_state = null, updated_at = now() WHERE id = $1`,
    [ccId]
  )

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { subject, body_md } = await req.json().catch(() => ({}))
  if (typeof subject !== 'string' || typeof body_md !== 'string') {
    return NextResponse.json({ error: 'subject and body_md required' }, { status: 400 })
  }
  await dbQuery(
    `UPDATE ${t('outreach_packets')}
     SET subject = $2, body_md = $3, last_updated_at = now()
     WHERE id = $1`,
    [params.id, subject, body_md]
  )
  return NextResponse.json({ ok: true })
}
