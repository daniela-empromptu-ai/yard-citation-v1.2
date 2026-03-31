import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { ccId: string } }) {
  try {
    // Look up the campaign_creator to get creator_id for content query
    const ccRes = await dbQuery<{ creator_id: string }>(
      `SELECT creator_id FROM campaign_creators WHERE id = $1`,
      [params.ccId]
    )

    const evalRes = await dbQuery(
      `SELECT * FROM creator_evaluations WHERE campaign_creator_id = $1`,
      [params.ccId]
    )
    if (!evalRes.data.length) return NextResponse.json(null)

    const evaluation = evalRes.data[0] as Record<string, unknown>

    const [snippets, angles, recommended, contentItemsRes] = await Promise.all([
      dbQuery(
        `SELECT es.*, ci.title as title, ci.url as url, ci.platform as platform
         FROM evidence_snippets es
         JOIN content_items ci ON ci.id = es.content_item_id
         WHERE es.evaluation_id = $1`,
        [evaluation.id]
      ),
      dbQuery(
        `SELECT * FROM content_angles WHERE evaluation_id = $1`,
        [evaluation.id]
      ),
      dbQuery(
        `SELECT erc.*, ci.title as content_title, ci.url as content_url, ci.metadata_json
         FROM evaluation_recommended_content erc
         JOIN content_items ci ON ci.id = erc.content_item_id
         WHERE erc.evaluation_id = $1
         ORDER BY erc.relevance_rank`,
        [evaluation.id]
      ),
      // Fetch content items evaluated for this creator
      ccRes.data.length > 0
        ? dbQuery<{ id: string; title: string; url: string; platform: string; published_at: string }>(
            `SELECT id, title, url, platform, published_at FROM content_items WHERE creator_id = $1 ORDER BY published_at DESC LIMIT 10`,
            [ccRes.data[0].creator_id]
          )
        : Promise.resolve({ data: [] }),
    ])

    return NextResponse.json({
      evaluation,
      evidenceSnippets: snippets.data,
      contentAngles: angles.data,
      recommendedContent: recommended.data,
      contentItems: contentItemsRes.data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
