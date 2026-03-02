import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await dbQuery(`SELECT * FROM clients ORDER BY name`, [])
  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { name, website_url } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
    }
    await dbQuery(
      `INSERT INTO clients (id, name, website_url, created_at, updated_at) VALUES (gen_random_uuid(),$1,$2,now(),now())`,
      [name.trim(), website_url || null]
    )
    // RETURNING * not supported by DB proxy — fetch the created row
    const result = await dbQuery(
      `SELECT * FROM clients WHERE name = $1`,
      [name.trim()]
    )
    return NextResponse.json(result.data[0] || { name: name.trim() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
