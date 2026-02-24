import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await dbQuery(
    `SELECT cst.*, u.name as approved_by_name
     FROM campaign_search_terms cst
     LEFT JOIN app_users u ON u.id = cst.approved_by_user_id
     WHERE cst.campaign_id = $1
     ORDER BY cst.order_index`,
    [params.id]
  )
  return NextResponse.json(result.data)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const terms = await req.json()
    for (const t of terms) {
      await dbQuery(
        `INSERT INTO campaign_search_terms (id, campaign_id, term, category_tag, why_it_helps, order_index, approved, created_at, updated_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,false,now(),now())
         ON CONFLICT DO NOTHING`,
        [params.id, t.term, t.category_tag, t.why_it_helps, t.order_index || 0]
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
