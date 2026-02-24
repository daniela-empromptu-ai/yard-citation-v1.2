import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET() {
  try {
    const result = await dbQuery(
      `SELECT c.*, cl.name as client_name, COALESCE(u.name, c.owner_user_id::text) as owner_name,
         (SELECT COUNT(*) FROM campaign_creators cc WHERE cc.campaign_id = c.id)::int as creator_count,
         (SELECT COUNT(*) FROM campaign_creators cc WHERE cc.campaign_id = c.id AND cc.pipeline_stage = 'outreach_ready')::int as outreach_ready_count
       FROM campaigns c
       LEFT JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN app_users u ON u.id = c.owner_user_id
       ORDER BY c.updated_at DESC`,
      []
    )
    return NextResponse.json(result.data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { client_id, name, owner_user_id, geo_targets, language, product_category, creative_brief } = body
    const params = [client_id, name, owner_user_id, geo_targets || [], language || 'English', product_category || '', creative_brief || ''];
    const result = await dbQuery(
      `INSERT INTO campaigns (id, client_id, name, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, created_at, updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,'draft','draft',$4,$5,$6,$7,now(),now()) RETURNING id`,
      params
    )
    if (result.data?.[0]) {
      return NextResponse.json(result.data[0])
    }
    // Backend may not return RETURNING data — fetch the inserted row
    const inserted = await dbQuery(
      `SELECT * FROM campaigns WHERE client_id=$1 AND name=$2 ORDER BY created_at DESC LIMIT 1`,
      [client_id, name]
    )
    return NextResponse.json(inserted.data[0] || { error: 'Insert succeeded but row not found' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
