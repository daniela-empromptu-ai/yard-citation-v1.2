import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await dbQuery(
    `SELECT id, title, url, published_at, fetched_at, metadata_json
     FROM ${t('content_items')}
     WHERE campaign_id = $1 AND platform = 'reddit'
     ORDER BY fetched_at DESC NULLS LAST`,
    [params.id]
  );
  return NextResponse.json({ threads: res.data });
}
