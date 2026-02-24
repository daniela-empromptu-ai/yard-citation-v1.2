import { NextResponse } from 'next/server';
import { dbSchema } from '@/lib/db';
import { SCHEMA_DEF } from '@/lib/schema-def';

export async function GET() {
  const result = await dbSchema(SCHEMA_DEF);
  return NextResponse.json(result);
}
