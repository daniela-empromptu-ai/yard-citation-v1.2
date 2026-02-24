import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { creator_id, campaign_id, url, title, raw_text, platform, content_type } = await req.json();
  const now = new Date().toISOString();
  const wc = raw_text ? raw_text.split(/\s+/).length : 0;

  const r = await dbQuery(
    `INSERT INTO ${t('content_items')} (id, creator_id, campaign_id, platform, content_type, title, url, raw_text, word_count, language, ingestion_method, ingestion_status, fetched_at, metadata_json, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'English','manual_paste','complete',$10,'{}'::jsonb,$11,$12)
     ON CONFLICT (url) DO UPDATE SET raw_text=EXCLUDED.raw_text, word_count=EXCLUDED.word_count, updated_at=EXCLUDED.updated_at
     RETURNING id`,
    [uuidv4(), creator_id, campaign_id || null, platform || 'other', content_type || 'other', title, url, raw_text || '', wc, now, now, now]
  );

  if (!r.success) {
    return NextResponse.json({ error: r.error || r.message }, { status: 500 });
  }

  // Update campaign_creator ingestion status
  if (campaign_id) {
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET ingestion_status='complete', updated_at=$1 WHERE campaign_id=$2 AND creator_id=$3`,
      [now, campaign_id, creator_id]
    );
  }

  return NextResponse.json({ ok: true, id: r.data[0]?.id });
}
