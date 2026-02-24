import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { dbSchema } from '@/lib/db';
import { SCHEMA_DEF } from '@/lib/schema-def';

export async function POST() {
  // Ensure schema exists first
  await dbSchema(SCHEMA_DEF);
  const result = await seedDatabase();
  return NextResponse.json(result);
}
