import { NextResponse } from 'next/server'
import { initSchema } from '@/lib/schema-init'

export async function POST() {
  try {
    await initSchema()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 200 })
  }
}
