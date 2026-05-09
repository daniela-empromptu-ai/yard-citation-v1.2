import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { fetchVisibilityAnalysis, VisibilityAnalysis } from '@/lib/gumshoe'

const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1h

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'

  const campRes = await dbQuery<{
    gumshoe_notes: string | null
    visibility_analysis_json: VisibilityAnalysis | null
    visibility_analysis_at: string | null
  }>(
    `SELECT gumshoe_notes, visibility_analysis_json, visibility_analysis_at
     FROM ${t('campaigns')} WHERE id = $1`,
    [params.id]
  )
  const camp = campRes.data[0]
  if (!camp) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  if (!camp.gumshoe_notes) {
    return NextResponse.json({ available: false, reason: 'No Gumshoe report URL on this campaign.' })
  }

  // Serve fresh cached value — but validate shape first; stale cache from older
  // code versions may be missing fields (brand, leaderboard, etc.)
  const isValidCache = (v: unknown): v is VisibilityAnalysis =>
    !!v && typeof v === 'object' &&
    'brand' in v && 'leaderboard' in v && 'gap_topics' in v && 'source_breakdown' in v

  if (!force && camp.visibility_analysis_json && camp.visibility_analysis_at) {
    const ageMs = Date.now() - new Date(camp.visibility_analysis_at).getTime()
    if (ageMs < CACHE_MAX_AGE_MS && isValidCache(camp.visibility_analysis_json)) {
      return NextResponse.json({
        available: true,
        cached: true,
        age_ms: ageMs,
        analysis: camp.visibility_analysis_json,
      })
    }
  }

  const analysis = await fetchVisibilityAnalysis(camp.gumshoe_notes)
  if (!analysis) {
    return NextResponse.json({
      available: false,
      reason: 'Could not fetch Gumshoe analysis (invalid URL, missing API key, or empty report).',
    })
  }

  // Persist cache (best-effort; don't fail the request if it errors)
  try {
    await dbQuery(
      `UPDATE ${t('campaigns')} SET visibility_analysis_json = $2::jsonb, visibility_analysis_at = now()
       WHERE id = $1`,
      [params.id, JSON.stringify(analysis)]
    )
  } catch (e) {
    console.warn('[visibility-analysis] cache write failed:', (e as Error).message)
  }

  return NextResponse.json({ available: true, cached: false, analysis })
}
