import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { fetchVisibilityAnalysis } from '@/lib/gumshoe'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const campRes = await dbQuery<{ gumshoe_notes: string | null }>(
    `SELECT gumshoe_notes FROM ${t('campaigns')} WHERE id = $1`,
    [params.id]
  )
  const camp = campRes.data[0]
  if (!camp) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  if (!camp.gumshoe_notes) {
    return NextResponse.json({ available: false, reason: 'No Gumshoe report URL on this campaign.' })
  }

  const analysis = await fetchVisibilityAnalysis(camp.gumshoe_notes)
  if (!analysis) {
    return NextResponse.json({
      available: false,
      reason: 'Could not fetch Gumshoe analysis (invalid URL, missing API key, or empty report).',
    })
  }

  return NextResponse.json({ available: true, analysis })
}
