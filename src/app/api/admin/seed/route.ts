import { NextResponse } from 'next/server'
import { initSchema } from '@/lib/schema-init'
import { seedDemoData } from '@/lib/seed-data'

export async function POST() {
  try {
    await initSchema()
    const result = await seedDemoData()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
