import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { runFullPipeline } from '@/lib/pipeline';

export async function POST(req: NextRequest) {
  const { campaign_id, user_id } = await req.json();
  const now = new Date().toISOString();

  // Approve all terms
  await dbQuery(
    `UPDATE ${t('campaign_search_terms')} SET approved=true, approved_by_user_id=$1, approved_at=$2, updated_at=$3 WHERE campaign_id=$4`,
    [user_id, now, now, campaign_id]
  );

  // Check for already-running pipeline
  const existingRes = await dbQuery<{ id: string }>(
    `SELECT id FROM ${t('jobs')} WHERE campaign_id = $1 AND type = 'full_pipeline' AND status IN ('queued', 'running') LIMIT 1`,
    [campaign_id]
  );
  if (existingRes.data.length > 0) {
    return NextResponse.json({ ok: true, job_id: existingRes.data[0].id, pipeline: 'already_running' });
  }

  // Create job and fire pipeline
  const jobId = uuidv4();
  await dbQuery(
    `INSERT INTO ${t('jobs')} (id, type, status, campaign_id, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'full_pipeline', 'queued', $2, $3, now(), now())`,
    [jobId, campaign_id, user_id]
  );

  runFullPipeline(campaign_id, user_id, jobId).catch(err =>
    console.error(`[approve-all] Pipeline error:`, err)
  );

  return NextResponse.json({ ok: true, job_id: jobId, pipeline: 'started' });
}
