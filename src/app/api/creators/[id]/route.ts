import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [creator, categories, campaigns, contentItems, evaluations] = await Promise.all([
      dbQuery(`SELECT * FROM creators WHERE id = $1`, [id]),
      dbQuery(
        `SELECT cat.* FROM categories cat JOIN creator_categories cc ON cc.category_id = cat.id WHERE cc.creator_id = $1 ORDER BY cat.name`,
        [id]
      ),
      dbQuery(
        `SELECT ccr.*, camp.name as campaign_name, camp.status as campaign_status,
           ce.overall_score, ce.evidence_coverage
         FROM campaign_creators ccr
         JOIN campaigns camp ON camp.id = ccr.campaign_id
         LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = ccr.id
         WHERE ccr.creator_id = $1
         ORDER BY ccr.created_at DESC`,
        [id]
      ),
      dbQuery(
        `SELECT * FROM content_items WHERE creator_id = $1 ORDER BY published_at DESC LIMIT 10`,
        [id]
      ),
      dbQuery(
        `SELECT ce.*, camp.name as campaign_name
         FROM creator_evaluations ce
         JOIN campaign_creators ccr ON ccr.id = ce.campaign_creator_id
         JOIN campaigns camp ON camp.id = ccr.campaign_id
         WHERE ccr.creator_id = $1
         ORDER BY ce.evaluated_at DESC`,
        [id]
      ),
    ])

    if (!creator.data.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      creator: creator.data[0],
      categories: categories.data,
      campaigns: campaigns.data,
      contentItems: contentItems.data,
      evaluations: evaluations.data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Updatable fields
    const allowed = [
      'name', 'platform', 'handle', 'url', 'platform_uid', 'subscriber_count',
      'content_language', 'relationship_status', 'too_expensive', 'brand_owned',
      'excluded', 'exclusion_reason', 'notes', 'email', 'contact_method',
    ]
    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1
    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx}`)
        values.push(body[key])
        idx++
      }
    }
    if (sets.length === 0 && !body.category_ids) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    if (sets.length > 0) {
      sets.push(`updated_at = now()`)
      values.push(id)
      await dbQuery(
        `UPDATE creators SET ${sets.join(', ')} WHERE id = $${idx}`,
        values
      )
    }

    // Update categories if provided
    if (body.category_ids !== undefined) {
      await dbQuery(`DELETE FROM creator_categories WHERE creator_id = $1`, [id])
      for (const catId of body.category_ids || []) {
        await dbQuery(
          `INSERT INTO creator_categories (creator_id, category_id) VALUES ($1, $2) ON CONFLICT (creator_id, category_id) DO NOTHING`,
          [id, catId]
        )
      }
    }

    const result = await dbQuery(`SELECT * FROM creators WHERE id = $1`, [id])
    return NextResponse.json(result.data[0] || { id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await dbQuery(`DELETE FROM creator_categories WHERE creator_id = $1`, [id])
    await dbQuery(`DELETE FROM creators WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
