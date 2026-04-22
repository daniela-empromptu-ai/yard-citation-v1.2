import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'

interface RouteContext {
  params: { id: string }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const campaignId = params.id

  // Get campaign stage
  const campRes = await dbQuery<{ stage: string }>(
    `SELECT stage FROM ${t('campaigns')} WHERE id = $1`,
    [campaignId]
  )
  const stage = campRes.data[0]?.stage || 'draft'

  // Get latest pipeline job
  const jobRes = await dbQuery<{
    id: string; type: string; status: string; error_message: string | null;
    started_at: string | null; finished_at: string | null; created_at: string
  }>(
    `SELECT id, type, status, error_message, started_at, finished_at, created_at
     FROM ${t('jobs')}
     WHERE campaign_id = $1 AND type IN ('full_pipeline', 'surface_more')
     ORDER BY created_at DESC LIMIT 1`,
    [campaignId]
  )

  const job = jobRes.data[0] || null

  // Get job events if job exists
  let events: { level: string; message: string; created_at: string }[] = []
  if (job) {
    const eventsRes = await dbQuery<{ level: string; message: string; created_at: string }>(
      `SELECT level, message, created_at
       FROM ${t('job_events')}
       WHERE job_id = $1
       ORDER BY created_at ASC`,
      [job.id]
    )
    events = eventsRes.data
  }

  return NextResponse.json({ stage, job, events })
}
