import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET() {
  const result = await dbQuery(`SELECT * FROM clients ORDER BY name`, [])
  return NextResponse.json(result.data)
}

export async function POST(req: NextRequest) {
  try {
    const { name, website_url } = await req.json()
    const result = await dbQuery(
      `INSERT INTO clients (id, name, website_url, created_at, updated_at) VALUES (gen_random_uuid(),$1,$2,now(),now()) RETURNING *`,
      [name, website_url || null]
    )
    return NextResponse.json(result.data[0])
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
