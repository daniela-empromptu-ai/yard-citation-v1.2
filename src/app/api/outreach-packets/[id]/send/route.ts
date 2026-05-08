import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

/**
 * V0 "send" — flips status to sent, logs activity. No SMTP integration:
 * the user copies the body to clipboard client-side and sends via their
 * own mail client. Keeps the human-in-loop guarantee from the original PRD.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user_id } = await req.json().catch(() => ({}))
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const packet = await dbQuery<{ campaign_creator_id: string }>(
    `SELECT campaign_creator_id FROM ${t('outreach_packets')} WHERE id = $1`,
    [params.id]
  )
  if (packet.data.length === 0) return NextResponse.json({ error: 'Packet not found' }, { status: 404 })
  const ccId = packet.data[0].campaign_creator_id

  await dbQuery(
    `UPDATE ${t('campaign_creators')}
     SET outreach_state = 'sent', last_outreach_at = now(), updated_at = now()
     WHERE id = $1`,
    [ccId]
  )
  await dbQuery(
    `INSERT INTO ${t('outreach_activity')} (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at)
     VALUES ($1, $2, $3, 'email', 'sent', 'sent', now())`,
    [uuidv4(), ccId, user_id]
  )

  return NextResponse.json({ ok: true, status: 'sent' })
}
