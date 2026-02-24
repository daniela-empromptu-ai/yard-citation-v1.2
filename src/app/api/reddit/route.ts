import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaign_id')

    let query = `
      SELECT ci.*, cr.display_name as creator_name, camp.name as campaign_name
      FROM content_items ci
      JOIN creators cr ON cr.id = ci.creator_id
      LEFT JOIN campaigns camp ON camp.id = ci.campaign_id
      WHERE ci.platform = 'reddit' AND ci.content_type = 'reddit_thread'
    `
    const params: unknown[] = []
    if (campaignId) {
      query += ` AND ci.campaign_id = $1`
      params.push(campaignId)
    }
    query += ` ORDER BY ci.fetched_at DESC NULLS LAST, ci.created_at DESC`

    const result = await dbQuery(query, params)
    return NextResponse.json(result.data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Stub Reddit fetch
  try {
    const { campaign_id, creator_id, subreddits, keywords } = await req.json()

    const isStub = (process.env.REDDIT_CLIENT_ID || '').startsWith('placeholder')
    if (isStub) {
      // Return stub data
      const stubThreads = (subreddits || ['kubernetes']).flatMap((sr: string) =>
        (keywords || ['kubernetes cost']).slice(0, 2).map((kw: string, i: number) => ({
          title: `[Stub] ${kw} discussion in r/${sr}`,
          url: `https://reddit.com/r/${sr}/comments/stub_${Date.now()}_${i}`,
          subreddit: sr,
          karma: Math.floor(Math.random() * 400) + 50,
          comment_count: Math.floor(Math.random() * 60) + 5,
          reddit_post_id: `stub_${sr}_${Date.now()}_${i}`,
        }))
      )

      for (const t of stubThreads) {
        try {
          await dbQuery(
            `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, fetched_at, raw_text, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
             VALUES (gen_random_uuid(),$1,$2,'reddit','reddit_thread',$3,$4,now(),$5,$6,'fetched','complete',now(),now())
             ON CONFLICT (url) DO NOTHING`,
            [
              creator_id, campaign_id, t.title, t.url,
              `Thread: ${t.title}\n\nStub content for ${t.subreddit}`,
              JSON.stringify({ subreddit: t.subreddit, karma: t.karma, comment_count: t.comment_count, reddit_post_id: t.reddit_post_id }),
            ]
          )
        } catch { /* skip duplicates */ }
      }

      return NextResponse.json({ ok: true, fetched: stubThreads.length, stub: true })
    }

    // Real Reddit API would go here
    return NextResponse.json({ ok: true, fetched: 0, message: 'Real Reddit API not implemented in V0' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
