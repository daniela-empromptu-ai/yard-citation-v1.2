import { NextRequest, NextResponse } from 'next/server'
import { aiDiscoverCreators } from '@/lib/ai-actions'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Use provided values or minimal hardcoded defaults
  const brief = body.brief ?? 'Short test brief'
  const topics = body.topics ?? ['kubernetes']
  const personas = body.personas ?? ['DevOps engineers']
  const seedCreators = body.seed_creators ?? []
  const count = body.count ?? 5

  console.log(`[test/discover] brief=${brief.length}c topics=${topics.length} seeds=${seedCreators.length} count=${count}`)

  const start = Date.now()
  const results = await aiDiscoverCreators({
    brief,
    topics,
    personas,
    gumshoeNotes: '',
    seedCreators,
    existingHandles: new Set(),
    count,
  })
  const elapsed = Date.now() - start

  return NextResponse.json({ elapsed_ms: elapsed, count: results.length, results })
}
