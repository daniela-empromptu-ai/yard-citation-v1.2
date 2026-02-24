import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { campaign_creator_id, state, user_id, channel = 'email', notes } = await req.json();
  const now = new Date().toISOString();

  await dbQuery(
    `UPDATE ${t('campaign_creators')} SET outreach_state=$1, last_outreach_at=$2, updated_at=$3 WHERE id=$4`,
    [state, now, now, campaign_creator_id]
  );

  // Log activity
  await dbQuery(
    `INSERT INTO ${t('outreach_activity')} (campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES ($1,$2,$3,'state_changed',$4,$5,$6)`,
    [campaign_creator_id, user_id, channel, state, now, notes || null]
  );

  // Log in activity_log
  await dbQuery(
    `INSERT INTO ${t('activity_log')} (campaign_id, creator_id, campaign_creator_id, actor_user_id, event_type, event_data_json, created_at)
     SELECT cc.campaign_id, cc.creator_id, $1, $2, 'outreach_state_changed', $3::jsonb, $4
     FROM ${t('campaign_creators')} cc WHERE cc.id = $1`,
    [campaign_creator_id, user_id, JSON.stringify({ state, channel }), now]
  );

  return NextResponse.json({ ok: true });
}
