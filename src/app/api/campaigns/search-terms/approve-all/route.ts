import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { campaign_id, user_id } = await req.json();
  const now = new Date().toISOString();
  await dbQuery(
    `UPDATE ${t('campaign_search_terms')} SET approved=true, approved_by_user_id=$1, approved_at=$2, updated_at=$3 WHERE campaign_id=$4`,
    [user_id, now, now, campaign_id]
  );
  return NextResponse.json({ ok: true });
}
