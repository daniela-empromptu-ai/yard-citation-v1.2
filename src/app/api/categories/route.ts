import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Return deduplicated categories (keep the oldest per name+parent_id)
    const result = await dbQuery(
      `SELECT DISTINCT ON (name, parent_id) id, name, parent_id, created_at
       FROM categories ORDER BY name, parent_id, created_at ASC`
    )
    return NextResponse.json(result.data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, parent_id } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Check for existing category with same name
    const existing = await dbQuery<{ id: string }>(
      `SELECT id FROM categories WHERE name = $1 AND parent_id IS NOT DISTINCT FROM $2 LIMIT 1`,
      [name.trim(), parent_id || null]
    )
    if (existing.data.length > 0) {
      return NextResponse.json({ error: `Category "${name.trim()}" already exists` }, { status: 409 })
    }

    await dbQuery(
      `INSERT INTO categories (name, parent_id, created_at) VALUES ($1, $2, now())`,
      [name.trim(), parent_id || null]
    )
    const result = await dbQuery(
      `SELECT * FROM categories WHERE name = $1 AND parent_id IS NOT DISTINCT FROM $2 ORDER BY created_at DESC LIMIT 1`,
      [name.trim(), parent_id || null]
    )
    return NextResponse.json(result.data[0] || { name: name.trim() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 })
    }
    await dbQuery(`DELETE FROM creator_categories WHERE category_id = $1`, [id])
    await dbQuery(`DELETE FROM categories WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
