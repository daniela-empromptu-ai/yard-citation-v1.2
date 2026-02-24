import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { ccId: string } }) {
  try {
    const evalRes = await dbQuery(
      `SELECT * FROM creator_evaluations WHERE campaign_creator_id = $1`,
      [params.ccId]
    )
    if (!evalRes.data.length) return NextResponse.json(null)

    const evaluation = evalRes.data[0] as Record<string, unknown>

    const [snippets, angles, recommended] = await Promise.all([
      dbQuery(
        `SELECT es.*, ci.title as content_title, ci.url as content_url
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
    ])

    return NextResponse.json({
      evaluation,
      evidenceSnippets: snippets.data,
      contentAngles: angles.data,
      recommendedContent: recommended.data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
