import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { dbQuery, dbInsertMany, t } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { topics } = (await req.json()) as { topics: string[] }
    const cleaned = (topics || []).map((s) => String(s).trim()).filter(Boolean)

    await dbQuery(`DELETE FROM ${t('campaign_topics')} WHERE campaign_id = $1`, [params.id])

    if (cleaned.length > 0) {
      const now = new Date().toISOString()
      const rows = cleaned.map((topic, i) => [
        uuidv4(), params.id, topic, 'manual', i, true, now,
      ])
      const r = await dbInsertMany(
        t('campaign_topics'),
        ['id', 'campaign_id', 'topic', 'source', 'order_index', 'approved', 'created_at'],
        rows,
      )
      if (!r.success) return NextResponse.json({ error: r.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: cleaned.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
