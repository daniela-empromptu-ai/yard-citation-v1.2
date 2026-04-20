import { NextRequest, NextResponse } from 'next/server'
import { enrichEvaluation } from '@/lib/enrich-evaluation'

export async function POST(_req: NextRequest, { params }: { params: { ccId: string } }) {
  try {
    const result = await enrichEvaluation(params.ccId)
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
