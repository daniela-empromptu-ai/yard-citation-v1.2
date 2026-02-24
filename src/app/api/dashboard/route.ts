import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET() {
  try {
    const [needsReview, recentScoring, outreachQueue, recentBooked, stats] = await Promise.all([
      // Needs manual review queue
      dbQuery(
        `SELECT cc.id as cc_id, cr.display_name, camp.name as campaign_name,
           ce.evidence_coverage, ce.overall_score, ce.needs_manual_review_reason,
           cc.updated_at, cc.pipeline_stage
         FROM campaign_creators cc
         JOIN creators cr ON cr.id = cc.creator_id
         JOIN campaigns camp ON camp.id = cc.campaign_id
         LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = cc.id
         WHERE cc.pipeline_stage = 'needs_manual_review'
         ORDER BY cc.updated_at DESC LIMIT 10`,
        []
      ),
      // Recent scoring runs
      dbQuery(
        `SELECT ce.*, cr.display_name, camp.name as campaign_name
         FROM creator_evaluations ce
         JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
         JOIN creators cr ON cr.id = cc.creator_id
         JOIN campaigns camp ON camp.id = cc.campaign_id
         ORDER BY ce.evaluated_at DESC LIMIT 10`,
        []
      ),
      // Outreach queue (outreach role)
      dbQuery(
        `SELECT cc.*, cr.display_name, camp.name as campaign_name,
           ce.overall_score, ce.evidence_coverage,
           u.name as outreach_owner_name
         FROM campaign_creators cc
         JOIN creators cr ON cr.id = cc.creator_id
         JOIN campaigns camp ON camp.id = cc.campaign_id
         LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = cc.id
         LEFT JOIN app_users u ON u.id = cc.outreach_owner_user_id
         WHERE cc.pipeline_stage IN ('outreach_ready', 'contacted') AND cc.outreach_state != 'booked'
         ORDER BY cc.next_followup_due_at ASC NULLS LAST LIMIT 10`,
        []
      ),
      // Recently replied/booked
      dbQuery(
        `SELECT cc.*, cr.display_name, camp.name as campaign_name,
           oa.notes as last_notes, oa.occurred_at as last_activity
         FROM campaign_creators cc
         JOIN creators cr ON cr.id = cc.creator_id
         JOIN campaigns camp ON camp.id = cc.campaign_id
         LEFT JOIN outreach_activity oa ON oa.campaign_creator_id = cc.id
         WHERE cc.outreach_state IN ('replied', 'booked')
         ORDER BY oa.occurred_at DESC NULLS LAST LIMIT 5`,
        []
      ),
      // Stats
      dbQuery(
        `SELECT
           (SELECT COUNT(*)::int FROM creator_evaluations WHERE evaluated_at >= now() - interval '7 days') as analyzed_week,
           (SELECT COUNT(*)::int FROM campaign_creators WHERE pipeline_stage = 'needs_manual_review') as needs_review,
           (SELECT COUNT(*)::int FROM campaign_creators WHERE pipeline_stage = 'outreach_ready') as outreach_ready,
           (SELECT COUNT(*)::int FROM campaigns WHERE status = 'active') as active_campaigns,
           (SELECT COUNT(*)::int FROM campaign_creators WHERE outreach_state = 'sent' AND last_outreach_at >= now() - interval '7 days') as emails_to_send,
           (SELECT COUNT(*)::int FROM campaign_creators WHERE next_followup_due_at <= CURRENT_DATE AND outreach_state = 'sent') as followups_due,
           (SELECT COUNT(*)::int FROM campaign_creators WHERE outreach_state = 'replied') as replies_to_log,
           (SELECT COUNT(*)::int FROM campaign_creators WHERE outreach_state = 'booked') as booked_count`,
        []
      ),
    ])

    return NextResponse.json({
      needsReview: needsReview.data,
      recentScoring: recentScoring.data,
      outreachQueue: outreachQueue.data,
      recentBooked: recentBooked.data,
      stats: stats.data[0] || {},
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
