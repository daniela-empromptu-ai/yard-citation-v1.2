import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { runSurfaceMorePipeline } from '@/lib/pipeline'
import { reapStaleJobs } from '@/lib/jobs'

interface RouteContext {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const campaignId = params.id
    const body = await req.json()
    const { user_id, seed_creator_id } = body as { user_id?: string; seed_creator_id?: string }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Self-heal: clear jobs stuck in queued/running for >30min (process died)
    await reapStaleJobs(campaignId)

    // Block if any pipeline job is already running for this campaign
    const existingRes = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('jobs')} WHERE campaign_id = $1 AND status IN ('queued', 'running') LIMIT 1`,
      [campaignId]
    )
    if (existingRes.data.length > 0) {
      return NextResponse.json(
        { error: 'Pipeline already running', job_id: existingRes.data[0].id },
        { status: 409 }
      )
    }

    const jobId = uuidv4()
    const jobType = seed_creator_id ? 'find_similar' : 'surface_more'
    await dbQuery(
      `INSERT INTO ${t('jobs')} (id, type, status, campaign_id, created_by_user_id, created_at, updated_at)
       VALUES ($1, $2, 'queued', $3, $4, now(), now())`,
      [jobId, jobType, campaignId, user_id]
    )

    runSurfaceMorePipeline(campaignId, user_id, jobId, seed_creator_id).catch(err =>
      console.error(`[surface-more] Unhandled error:`, err)
    )

    return NextResponse.json({ ok: true, job_id: jobId })
  } catch (e) {
    console.error('[surface-more] Error:', e)
    return NextResponse.json({ error: (e as Error).message || 'Internal error' }, { status: 500 })
  }
}
