import { NextRequest, NextResponse } from 'next/server'
import { aiSuggestTopics } from '@/lib/ai-actions'

export async function POST(req: NextRequest) {
  try {
    const { brief } = await req.json()
    const topics = await aiSuggestTopics(brief)
    return NextResponse.json(topics)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
