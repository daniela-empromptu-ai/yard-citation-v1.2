import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''

    let query = `
      SELECT cr.*,
        ARRAY(
          SELECT platform FROM creator_platform_accounts WHERE creator_id = cr.id
        ) as platforms,
        (
          SELECT json_agg(json_build_object('flag', flag, 'is_active', is_active))
          FROM creator_status_flags WHERE creator_id = cr.id AND is_active = true
        ) as active_flags,
        (
          SELECT price_amount_usd FROM creator_pricing WHERE creator_id = cr.id LIMIT 1
        ) as pricing_usd,
        (
          SELECT MAX(ce.overall_score)
          FROM creator_evaluations ce
          JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
          WHERE cc.creator_id = cr.id
        ) as best_score
      FROM creators cr
    `
    const params: unknown[] = []
    if (q) {
      query += ` WHERE cr.display_name ILIKE $1 OR cr.primary_handle ILIKE $1 OR $1 = ANY(cr.topics)`
      params.push(`%${q}%`)
    }
    query += ` ORDER BY cr.updated_at DESC`

    const result = await dbQuery(query, params)
    return NextResponse.json(result.data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await dbQuery(
      `INSERT INTO creators (id, display_name, primary_handle, bio, topics, languages, geo_focus, created_at, updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,now(),now()) RETURNING *`,
      [body.display_name, body.primary_handle || null, body.bio || null,
       body.topics || [], body.languages || ['English'], body.geo_focus || []]
    )
    return NextResponse.json(result.data[0])
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
