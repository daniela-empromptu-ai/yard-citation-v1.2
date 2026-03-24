import { NextRequest, NextResponse } from 'next/server'
import { aiGenerateSearchTerms } from '@/lib/ai-actions'
import { dbQuery, dbInsertMany } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, brief, topics, personas, product_category } = await req.json()
    const terms = await aiGenerateSearchTerms(brief, topics, personas, product_category)

    if (campaign_id && terms.length > 0) {
      await dbQuery(
        `DELETE FROM campaign_search_terms WHERE campaign_id = $1 AND approved = false`,
        [campaign_id]
      )
      const now = new Date().toISOString()
      await dbInsertMany(
        'campaign_search_terms',
        ['id', 'campaign_id', 'term', 'category_tag', 'why_it_helps', 'order_index', 'approved', 'created_at', 'updated_at'],
        terms.map((t, i) => [uuidv4(), campaign_id, t.term, t.category_tag, t.why_it_helps, i + 1, false, now, now]),
        'DO NOTHING'
      )
      // Return saved rows with IDs so client doesn't need a second fetch
      const saved = await dbQuery(
        `SELECT * FROM campaign_search_terms WHERE campaign_id = $1 ORDER BY order_index`,
        [campaign_id]
      )
      return NextResponse.json(saved.data)
    }
    return NextResponse.json(terms)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
