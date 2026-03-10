import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const platform = searchParams.get('platform') || ''
    const category = searchParams.get('category') || ''
    const excluded = searchParams.get('excluded')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    if (q) {
      conditions.push(`(c.name ILIKE $${paramIdx} OR c.handle ILIKE $${paramIdx})`)
      params.push(`%${q}%`)
      paramIdx++
    }
    if (platform) {
      conditions.push(`c.platform = $${paramIdx}`)
      params.push(platform)
      paramIdx++
    }
    if (category) {
      conditions.push(`EXISTS (SELECT 1 FROM creator_categories cc2 JOIN categories cat ON cat.id = cc2.category_id WHERE cc2.creator_id = c.id AND cat.name = $${paramIdx})`)
      params.push(category)
      paramIdx++
    }
    if (excluded === 'true') {
      conditions.push(`c.excluded = true`)
    } else if (excluded === 'false') {
      conditions.push(`c.excluded = false`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = await dbQuery<{ count: string }>(
      `SELECT COUNT(*) as count FROM creators c ${where}`,
      params
    )
    const total = parseInt(countResult.data[0]?.count || '0')

    const result = await dbQuery(
      `SELECT c.*,
        COALESCE((
          SELECT string_agg(cat.name, ', ' ORDER BY cat.name)
          FROM creator_categories cc2
          JOIN categories cat ON cat.id = cc2.category_id
          WHERE cc2.creator_id = c.id
        ), '') as category_names,
        (
          SELECT MAX(ce.overall_score)
          FROM creator_evaluations ce
          JOIN campaign_creators ccr ON ccr.id = ce.campaign_creator_id
          WHERE ccr.creator_id = c.id
        ) as best_score
      FROM creators c
      ${where}
      ORDER BY c.updated_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      data: result.data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Creator name is required' }, { status: 400 })
    }
    if (!body.platform?.trim()) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
    }

    await dbQuery(
      `INSERT INTO creators (name, platform, handle, url, platform_uid, subscriber_count, content_language, relationship_status, notes, discovered_via, email, contact_method, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())`,
      [
        body.name.trim(),
        body.platform.trim(),
        body.handle || null,
        body.url || null,
        body.platform_uid || null,
        body.subscriber_count || null,
        body.content_language || 'English',
        body.relationship_status || 'none',
        body.notes || null,
        body.discovered_via || 'manual',
        body.email || null,
        body.contact_method || null,
      ]
    )

    // Fetch created row
    const result = await dbQuery(
      `SELECT * FROM creators WHERE name = $1 AND platform = $2 ORDER BY created_at DESC LIMIT 1`,
      [body.name.trim(), body.platform.trim()]
    )
    const creator = result.data[0] as Record<string, unknown> | undefined

    // Link categories if provided
    if (creator?.id && body.category_ids?.length) {
      for (const catId of body.category_ids) {
        await dbQuery(
          `INSERT INTO creator_categories (creator_id, category_id) VALUES ($1, $2) ON CONFLICT (creator_id, category_id) DO NOTHING`,
          [creator.id, catId]
        )
      }
    }

    return NextResponse.json(creator || { name: body.name.trim() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
