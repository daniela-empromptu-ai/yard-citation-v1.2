import { NextRequest, NextResponse } from 'next/server'
import { discoverByRapidResearch, discoverByDevtoTagSearch } from '@/lib/discovery'
import { callAIApi } from '@/lib/db'

/**
 * Isolated test for Phase B2 discovery (Medium rapid_research + Dev.to tag search).
 * Auth-protected via middleware. DELETE this route when done testing.
 *
 * GET /api/admin/test-b2-discovery?topics=kubernetes,devops,gitops
 * GET /api/admin/test-b2-discovery?topics=kubernetes,devops,gitops&debug=1  — raw rapid_research response
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('topics') || 'kubernetes,devops'
  const topics = raw.split(',').map(t => t.trim()).filter(Boolean)
  const debug = req.nextUrl.searchParams.get('debug') === '1'

  const start = Date.now()

  // Debug mode: return raw rapid_research response so we can see what the API actually gives back
  if (debug) {
    const topicStr = topics.slice(0, 5).join(', ')
    try {
      const res = await callAIApi('/rapid_research', {
        goal: `Find 8 independent individual technical writers on Medium who publish about: ${topicStr}. Exclude company blogs and vendor accounts. List their Medium profile URLs in the format medium.com/@handle.`,
      })
      return NextResponse.json({ topics, elapsed_ms: Date.now() - start, raw_response: res })
    } catch (e) {
      return NextResponse.json({ topics, elapsed_ms: Date.now() - start, error: (e as Error).message }, { status: 500 })
    }
  }

  const [rrResult, devtoResult] = await Promise.all([
    discoverByRapidResearch(topics).catch(e => ({ creators: [], newInserted: 0, error: (e as Error).message })),
    discoverByDevtoTagSearch(topics).catch(e => ({ creators: [], newInserted: 0, error: (e as Error).message })),
  ])

  return NextResponse.json({
    topics,
    elapsed_ms: Date.now() - start,
    medium: {
      found: rrResult.creators.length,
      new_inserted: rrResult.newInserted,
      creators: rrResult.creators,
    },
    devto: {
      found: devtoResult.creators.length,
      new_inserted: devtoResult.newInserted,
      creators: devtoResult.creators,
    },
  })
}
