import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { isYouTubeConfigured } from '@/lib/anthropic'
import { runPrequalifyPipeline } from '@/lib/prequalify'

interface RouteContext {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const campaignId = params.id

  try {
    const body = await req.json()
    const { user_id } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (!isYouTubeConfigured()) {
      return NextResponse.json(
        { error: 'YouTube API key not configured. Set a real YOUTUBE_API_KEY in .env.local (replace the placeholder).' },
        { status: 400 }
      )
    }

    // Load campaign context
    const campaignRes = await dbQuery<{ creative_brief: string }>(
      `SELECT creative_brief FROM ${t('campaigns')} WHERE id = $1`,
      [campaignId]
    )
    if (!campaignRes.success || campaignRes.data.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const topicsRes = await dbQuery<{ topic: string; approved: boolean }>(
      `SELECT topic, approved FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
      [campaignId]
    )
    let topics = topicsRes.data.filter(r => r.approved).map(r => r.topic)
    if (topics.length === 0) {
      topics = topicsRes.data.map(r => r.topic)
    }
    if (topics.length === 0) {
      return NextResponse.json({ error: 'No topics for this campaign. Add topics before pre-qualifying.' }, { status: 400 })
    }

    const campaignContext = {
      brief: campaignRes.data[0].creative_brief,
      topics,
    }

    const result = await runPrequalifyPipeline(campaignId, user_id, campaignContext)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (e) {
    console.error('Pre-qualification error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
