import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string; creatorId: string } }) {
  const res = await dbQuery(
    `SELECT id, title, url, platform, content_type, word_count, published_at, fetched_at, metadata_json, ingestion_status, raw_text
     FROM ${t('content_items')}
     WHERE creator_id = $1 AND campaign_id = $2
     ORDER BY published_at DESC NULLS LAST`,
    [params.creatorId, params.id]
  );
  return NextResponse.json({ items: res.data });
}
