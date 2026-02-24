import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { campaign_id, creator_url, creator_id, user_id } = await req.json();
  const now = new Date().toISOString();

  let finalCreatorId = creator_id;

  // If no creator_id, create a stub creator from the URL
  if (!finalCreatorId && creator_url) {
    finalCreatorId = uuidv4();
    const handle = creator_url.includes('@') ? creator_url.split('@').pop()?.split('/')[0] : creator_url;
    await dbQuery(
      `INSERT INTO ${t('creators')} (id, display_name, primary_handle, created_at, updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [finalCreatorId, handle || 'Unknown Creator', `@${handle}`, now, now]
    );
    // Add platform account
    if (creator_url) {
      await dbQuery(
        `INSERT INTO ${t('creator_platform_accounts')} (creator_id, platform, url, created_at) VALUES ($1,'youtube',$2,$3) ON CONFLICT DO NOTHING`,
        [finalCreatorId, creator_url, now]
      );
    }
  }

  if (!finalCreatorId) {
    return NextResponse.json({ error: 'No creator ID or URL provided' }, { status: 400 });
  }

  // Add to campaign
  const r = await dbQuery(
    `INSERT INTO ${t('campaign_creators')} (id, campaign_id, creator_id, added_by_user_id, pipeline_stage, ingestion_status, scoring_status, outreach_state, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'discovered','not_started','not_scored','not_started',$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
    [uuidv4(), campaign_id, finalCreatorId, user_id, now, now]
  );

  if (!r.success) {
    return NextResponse.json({ error: r.error || r.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, creator_id: finalCreatorId });
}
