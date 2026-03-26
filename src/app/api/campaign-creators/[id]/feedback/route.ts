import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { feedback, rating } = await req.json()
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET client_feedback = $1, client_rating = $2, updated_at = now() WHERE id = $3`,
      [feedback ?? null, rating ?? null, params.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
