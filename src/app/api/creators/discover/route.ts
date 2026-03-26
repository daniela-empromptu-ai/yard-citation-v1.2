import { NextRequest, NextResponse } from 'next/server'
import { discoverCreatorsByCategories } from '@/lib/discovery'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { categoryIds } = await req.json()

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json({ error: 'At least one category must be selected' }, { status: 400 })
    }

    if (categoryIds.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 categories per discovery run' }, { status: 400 })
    }

    const result = await discoverCreatorsByCategories(categoryIds)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[discover] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
