import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { integration_key } = await req.json()
    let result = 'success'
    let message = 'Connection successful'

    // Stub tests
    if (integration_key === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY || ''
      if (key.startsWith('placeholder')) {
        result = 'failure'
        message = 'ANTHROPIC_API_KEY is a placeholder. Set real key in .env.local'
      } else {
        message = 'Anthropic API key configured'
      }
    } else if (integration_key === 'youtube') {
      const key = process.env.YOUTUBE_API_KEY || ''
      if (key.startsWith('placeholder')) {
        result = 'failure'
        message = 'YOUTUBE_API_KEY is a placeholder (V0 stubs active)'
      } else {
        message = 'YouTube API key configured'
      }
    } else if (integration_key === 'reddit') {
      const key = process.env.REDDIT_CLIENT_ID || ''
      if (key.startsWith('placeholder')) {
        result = 'failure'
        message = 'REDDIT_CLIENT_ID is a placeholder (V0 stubs active)'
      } else {
        message = 'Reddit credentials configured'
      }
    } else if (integration_key === 'gumshoe') {
      message = 'Gumshoe: CSV import available (no live API in V0)'
    }

    await dbQuery(
      `UPDATE integration_status SET is_configured=$1, last_tested_at=now(), last_test_result=$2, last_test_message=$3, updated_at=now() WHERE integration_key=$4`,
      [result === 'success', result, message, integration_key]
    )

    return NextResponse.json({ ok: true, result, message })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
