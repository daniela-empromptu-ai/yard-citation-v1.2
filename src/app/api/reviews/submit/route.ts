import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const DECISION_TO_STAGE: Record<string, string> = {
  approved_for_outreach: 'outreach_ready',
  rejected: 'rejected',
  needs_manual_review: 'needs_manual_review',
  excluded: 'excluded',
};

export async function POST(req: NextRequest) {
  const { campaign_creator_id, user_id, decision, notes_md, manual_override_score } = await req.json();
  const now = new Date().toISOString();

  const r = await dbQuery(
    `INSERT INTO ${t('human_reviews')} (id, campaign_creator_id, reviewed_by_user_id, reviewed_at, decision, manual_override_score, notes_md, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [uuidv4(), campaign_creator_id, user_id, now, decision, manual_override_score || null, notes_md || null, now]
  );

  if (!r.success) {
    return NextResponse.json({ error: r.error || r.message }, { status: 500 });
  }

  const newStage = DECISION_TO_STAGE[decision] || 'scored';
  await dbQuery(
    `UPDATE ${t('campaign_creators')} SET pipeline_stage=$1, updated_at=$2 WHERE id=$3`,
    [newStage, now, campaign_creator_id]
  );

  // Log activity
  await dbQuery(
    `INSERT INTO ${t('activity_log')} (campaign_id, creator_id, campaign_creator_id, actor_user_id, event_type, event_data_json, created_at)
     SELECT cc.campaign_id, cc.creator_id, $1, $2, 'review_decision', $3::jsonb, $4
     FROM ${t('campaign_creators')} cc WHERE cc.id = $1`,
    [campaign_creator_id, user_id, JSON.stringify({ decision, notes_md, manual_override_score }), now]
  );

  return NextResponse.json({ ok: true });
}
