import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { runSurfaceMorePipeline } from '@/lib/pipeline'

interface RouteContext {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const campaignId = params.id
    const { user_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

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
    await dbQuery(
      `INSERT INTO ${t('jobs')} (id, type, status, campaign_id, created_by_user_id, created_at, updated_at)
       VALUES ($1, 'surface_more', 'queued', $2, $3, now(), now())`,
      [jobId, campaignId, user_id]
    )

    runSurfaceMorePipeline(campaignId, user_id, jobId).catch(err =>
      console.error(`[surface-more] Unhandled error:`, err)
    )

    return NextResponse.json({ ok: true, job_id: jobId })
  } catch (e) {
    console.error('[surface-more] Error:', e)
    return NextResponse.json({ error: (e as Error).message || 'Internal error' }, { status: 500 })
  }
}
