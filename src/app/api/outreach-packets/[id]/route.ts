import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await dbQuery(
    `SELECT * FROM ${t('outreach_packets')} WHERE id = $1`,
    [params.id]
  )
  return NextResponse.json({ packet: res.data[0] || null })
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
