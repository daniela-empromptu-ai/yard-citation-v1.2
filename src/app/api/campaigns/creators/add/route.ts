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
    const handle = creator_url.includes('@') ? creator_url.split('@').pop()?.split('/')[0] : null;
    const platform = creator_url.includes('youtube') ? 'youtube'
      : creator_url.includes('medium.com') ? 'medium'
      : creator_url.includes('dev.to') ? 'devto'
      : creator_url.includes('linkedin') ? 'linkedin'
      : creator_url.includes('github') ? 'github'
      : 'blog';

    await dbQuery(
      `INSERT INTO ${t('creators')} (id, name, display_name, platform, handle, url, discovered_via, created_at, updated_at)
       VALUES ($1, $2, $2, $3, $4, $5, 'manual', $6, $6)
       ON CONFLICT DO NOTHING`,
      [finalCreatorId, handle || 'Unknown Creator', platform, handle || null, creator_url, now]
    );
  }

  if (!finalCreatorId) {
    return NextResponse.json({ error: 'No creator ID or URL provided' }, { status: 400 });
  }

  // Add to campaign
  await dbQuery(
    `INSERT INTO ${t('campaign_creators')} (id, campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'manual', 'discovered', 'not_scored', $5, $5)
     ON CONFLICT DO NOTHING`,
    [uuidv4(), campaign_id, finalCreatorId, user_id, now]
  );

  return NextResponse.json({ ok: true, creator_id: finalCreatorId });
}
