import { NextResponse } from 'next/server'
import { clearDemoData } from '@/lib/clear-data'

export async function POST() {
  try {
    const result = await clearDemoData()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
