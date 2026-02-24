import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; termId: string } }) {
  try {
    const body = await req.json()
    const { approved, approved_by_user_id, notes } = body
    await dbQuery(
      `UPDATE campaign_search_terms SET approved=$1, approved_by_user_id=$2, approved_at=CASE WHEN $1 THEN now() ELSE NULL END, notes=$3, updated_at=now() WHERE id=$4 AND campaign_id=$5`,
      [approved, approved_by_user_id, notes, params.termId, params.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
