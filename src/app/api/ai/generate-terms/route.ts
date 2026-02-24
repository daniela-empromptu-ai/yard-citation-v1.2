import { NextRequest, NextResponse } from 'next/server'
import { aiGenerateSearchTerms } from '@/lib/ai-actions'
import { dbQuery } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, brief, topics, personas, product_category } = await req.json()
    const terms = await aiGenerateSearchTerms(brief, topics, personas, product_category)

    if (campaign_id && terms.length > 0) {
      // Clear existing unapproved terms then insert
      for (let i = 0; i < terms.length; i++) {
        const t = terms[i]
        await dbQuery(
          `INSERT INTO campaign_search_terms (id, campaign_id, term, category_tag, why_it_helps, order_index, approved, created_at, updated_at)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,false,now(),now())
           ON CONFLICT DO NOTHING`,
          [campaign_id, t.term, t.category_tag, t.why_it_helps, i + 1]
        )
      }
    }
    return NextResponse.json(terms)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
