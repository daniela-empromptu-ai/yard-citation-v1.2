import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function writeEvent(jobId: string, level: string, message: string) {
  await dbQuery(
    `INSERT INTO ${t('job_events')} (job_id, level, message, created_at) VALUES ($1, $2, $3, now())`,
    [jobId, level, message]
  )
}

async function setStage(campaignId: string, stage: string) {
  await dbQuery(`UPDATE ${t('campaigns')} SET stage=$1, updated_at=now() WHERE id=$2`, [stage, campaignId])
}

async function fakePipelineRun(campaignId: string, jobId: string) {
  try {
    // Start
    await dbQuery(`UPDATE ${t('jobs')} SET status='running', started_at=now(), updated_at=now() WHERE id=$1`, [jobId])
    await writeEvent(jobId, 'info', 'Pipeline started')
    await setStage(campaignId, 'discovery')
    await writeEvent(jobId, 'info', 'Step 1/3: Discovery — searching platforms for relevant creators')

    await sleep(4000)
    await writeEvent(jobId, 'info', 'Searching YouTube for FinOps and Kubernetes cost content...')

    await sleep(4000)
    await writeEvent(jobId, 'info', 'Scanning Medium and Dev.to for technical writers...')

    await sleep(4000)
    await writeEvent(jobId, 'info', 'Found 24 potential creators from YouTube search')

    await sleep(3000)
    await writeEvent(jobId, 'info', 'LLM quality filter: removed 6 brand channels and 4 tutorial mills')

    await sleep(3000)
    await writeEvent(jobId, 'info', 'Discovery complete: 8 high-quality creators identified')
    await setStage(campaignId, 'ingestion')
    await writeEvent(jobId, 'info', 'Step 2/3: Pre-qualification — fetching content and checking relevancy')

    await sleep(4000)
    await writeEvent(jobId, 'info', 'Fetching transcripts for DevOps & AI Toolkit (3 videos)...')

    await sleep(3000)
    await writeEvent(jobId, 'info', 'Pre-qualifying Anton Putra — analyzing cost comparison content...')

    await sleep(3000)
    await writeEvent(jobId, 'info', 'Pre-qualifying Abhishek Veeramalla — 595K subs, K8s cost tutorials...')

    await sleep(3000)
    await writeEvent(jobId, 'info', 'Pre-qualification complete: 8/8 creators passed relevancy check')
    await setStage(campaignId, 'scoring')
    await writeEvent(jobId, 'info', 'Step 3/3: Scoring — evaluating creators with AI')

    await sleep(3000)
    await writeEvent(jobId, 'info', 'Scoring DevOps & AI Toolkit: 91/100 — strong FinOps expertise')

    await sleep(2000)
    await writeEvent(jobId, 'info', 'Scoring Anton Putra: 87/100 — excellent cost comparison format')

    await sleep(2000)
    await writeEvent(jobId, 'info', 'Scoring Abhishek Veeramalla: 86/100 — massive engaged audience')

    await sleep(2000)
    await writeEvent(jobId, 'info', 'Scoring Bret Fisher: 83/100 — Docker Captain credibility')

    await sleep(2000)
    await writeEvent(jobId, 'info', 'Scoring complete: 8/8 creators evaluated')

    // Complete
    await setStage(campaignId, 'review')
    await dbQuery(`UPDATE ${t('jobs')} SET status='completed', finished_at=now(), updated_at=now() WHERE id=$1`, [jobId])
    await writeEvent(jobId, 'info', 'Pipeline completed — 8 curated creators ready for review')
  } catch (e) {
    console.error('[demo/fake-pipeline]', e)
    await dbQuery(`UPDATE ${t('jobs')} SET status='failed', error_message=$1, finished_at=now(), updated_at=now() WHERE id=$2`, [(e as Error).message, jobId])
  }
}

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, user_id } = await req.json()

    // Approve all terms
    await dbQuery(
      `UPDATE ${t('campaign_search_terms')} SET approved=true, approved_by_user_id=$1, approved_at=now(), updated_at=now() WHERE campaign_id=$2`,
      [user_id, campaign_id]
    )

    // Guard: already running
    const existingRes = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('jobs')} WHERE campaign_id = $1 AND type = 'full_pipeline' AND status IN ('queued', 'running') LIMIT 1`,
      [campaign_id]
    )
    if (existingRes.data.length > 0) {
      return NextResponse.json({ ok: true, job_id: existingRes.data[0].id, pipeline: 'already_running' })
    }

    // Create job
    const jobId = uuidv4()
    await dbQuery(
      `INSERT INTO ${t('jobs')} (id, type, status, campaign_id, created_by_user_id, created_at, updated_at)
       VALUES ($1, 'full_pipeline', 'queued', $2, $3, now(), now())`,
      [jobId, campaign_id, user_id]
    )

    // Fire and forget
    fakePipelineRun(campaign_id, jobId).catch(err =>
      console.error('[demo/fake-pipeline] Error:', err)
    )

    return NextResponse.json({ ok: true, job_id: jobId, pipeline: 'started' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
