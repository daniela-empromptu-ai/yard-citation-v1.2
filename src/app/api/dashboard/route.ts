import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET() {
  try {
    const [needsReview, recentScoring, recentActivity, stats] = await Promise.all([
      // Creators flagged for manual review
      dbQuery(
        `SELECT cc.id as cc_id, cr.name as creator_name, cr.platform, camp.name as campaign_name,
           ce.evidence_coverage, ce.overall_score, ce.needs_manual_review_reason,
           cc.updated_at
         FROM campaign_creators cc
         JOIN creators cr ON cr.id = cc.creator_id
         JOIN campaigns camp ON camp.id = cc.campaign_id
         LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = cc.id
         WHERE ce.needs_manual_review = true
         ORDER BY cc.updated_at DESC LIMIT 10`,
        []
      ),
      // Recent scoring results
      dbQuery(
        `SELECT ce.id, ce.overall_score, ce.evidence_coverage, ce.needs_manual_review,
           ce.evaluated_at, cr.name as creator_name, cr.platform,
           camp.name as campaign_name, camp.id as campaign_id
         FROM creator_evaluations ce
         JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
         JOIN creators cr ON cr.id = cc.creator_id
         JOIN campaigns camp ON camp.id = cc.campaign_id
         ORDER BY ce.evaluated_at DESC NULLS LAST LIMIT 10`,
        []
      ),
      // Recent activity
      dbQuery(
        `SELECT al.event_type, al.event_data_json, al.created_at,
           camp.name as campaign_name, camp.id as campaign_id,
           cr.name as creator_name
         FROM activity_log al
         LEFT JOIN campaigns camp ON camp.id = al.campaign_id
         LEFT JOIN creators cr ON cr.id = al.creator_id
         ORDER BY al.created_at DESC LIMIT 15`,
        []
      ),
      // Stats
      dbQuery(
        `SELECT
           (SELECT COUNT(*)::int FROM campaigns WHERE status = 'active') as active_campaigns,
           (SELECT COUNT(*)::int FROM creators) as total_creators,
           (SELECT COUNT(*)::int FROM creator_evaluations WHERE evaluated_at >= now() - interval '7 days') as scored_this_week,
           (SELECT COUNT(*)::int FROM creator_evaluations ce WHERE ce.needs_manual_review = true) as needs_review,
           (SELECT COUNT(*)::int FROM campaign_creators) as total_campaign_creators,
           (SELECT COUNT(*)::int FROM campaign_creators WHERE scoring_status = 'scored') as total_scored`,
        []
      ),
    ])

    return NextResponse.json({
      needsReview: needsReview.data,
      recentScoring: recentScoring.data,
      recentActivity: recentActivity.data,
      stats: stats.data[0] || {},
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
