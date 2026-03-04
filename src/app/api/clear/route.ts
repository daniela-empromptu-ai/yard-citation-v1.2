import { NextResponse } from 'next/server';
import { clearDatabase } from '@/lib/clear';

export async function POST() {
  try {
    const result = await clearDatabase();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
